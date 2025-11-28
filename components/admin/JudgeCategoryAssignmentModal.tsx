import React, { useState, useContext, useMemo, FormEvent, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { User, Project, JudgeAssignment, UserRole, CompetitionLevel, ProjectStatus } from '../../types';
import { Trash2, AlertCircle, PlusCircle, CheckCircle } from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

type Section = 'Part A' | 'Part B & C';
const SECTIONS: Section[] = ['Part A', 'Part B & C'];
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN];

// --- NEW HELPER FUNCTIONS ---
const getAdminLevelForJudge = (judge: User): UserRole => {
    if (judge.workSubCounty) return UserRole.SUB_COUNTY_ADMIN;
    if (judge.workCounty) return UserRole.COUNTY_ADMIN;
    if (judge.workRegion) return UserRole.REGIONAL_ADMIN;
    return UserRole.NATIONAL_ADMIN; // No scope = national judge
};

const checkAssignmentPermission = (admin: User, judge: User): { allowed: boolean; message: string } => {
    if (admin.currentRole === UserRole.SUPER_ADMIN) {
        return { allowed: true, message: '' };
    }

    const requiredAdminRole = getAdminLevelForJudge(judge);
    
    if (admin.currentRole !== requiredAdminRole) {
        const roleName = requiredAdminRole.replace(' Admin', '');
        return { allowed: false, message: `This judge must be assigned by a ${roleName} Admin.` };
    }

    // Now check if they are the *correct* admin for that level
    switch(admin.currentRole) {
        case UserRole.SUB_COUNTY_ADMIN:
            if (admin.workSubCounty !== judge.workSubCounty || admin.workCounty !== judge.workCounty || admin.workRegion !== judge.workRegion) {
                return { allowed: false, message: `You are not the admin for the '${judge.workSubCounty}' sub-county.` };
            }
            break;
        case UserRole.COUNTY_ADMIN:
             if (admin.workCounty !== judge.workCounty || admin.workRegion !== judge.workRegion) {
                return { allowed: false, message: `You are not the admin for the '${judge.workCounty}' county.` };
            }
            break;
        case UserRole.REGIONAL_ADMIN:
             if (admin.workRegion !== judge.workRegion) {
                return { allowed: false, message: `You are not the admin for the '${judge.workRegion}' region.` };
            }
            break;
    }

    return { allowed: true, message: '' };
};
// --- END NEW HELPER FUNCTIONS ---


interface JudgeCategoryAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    judge: User;
}

const JudgeCategoryAssignmentModal: React.FC<JudgeCategoryAssignmentModalProps> = ({ isOpen, onClose, judge }) => {
    const { 
        user,
        users,
        projects, 
        assignments, 
        viewingLevel,
        assignJudgeToSectionForLevel,
        unassignJudgeFromSectionForLevel,
        showNotification,
        updateUserInList,
    } = useContext(AppContext);

    const [selectedRole, setSelectedRole] = useState<UserRole.JUDGE | UserRole.COORDINATOR>(UserRole.JUDGE);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSection, setSelectedSection] = useState<Section>('Part A');
    const [error, setError] = useState('');
    
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    const allCategories = useMemo(() => [...new Set(projects.map(p => p.category))].sort(), [projects]);

    const canManage = useMemo(() => {
        if (!user) return false;
        if (user.currentRole === UserRole.SUPER_ADMIN) return true;
    
        const roleToLevelMap: { [key in UserRole]?: CompetitionLevel } = {
            [UserRole.SUB_COUNTY_ADMIN]: CompetitionLevel.SUB_COUNTY,
            [UserRole.COUNTY_ADMIN]: CompetitionLevel.COUNTY,
            [UserRole.REGIONAL_ADMIN]: CompetitionLevel.REGIONAL,
            [UserRole.NATIONAL_ADMIN]: CompetitionLevel.NATIONAL,
        };
        
        const expectedLevel = roleToLevelMap[user.currentRole];
        return expectedLevel === viewingLevel;
    
    }, [user, viewingLevel]);
    
    const judgeAssignmentSummary: Record<string, Set<Section>> = useMemo(() => {
        if (!judge) return {};

        const assignmentsForJudgeAtLevel = assignments.filter(a =>
            a.judgeId === judge.id &&
            a.competitionLevel === viewingLevel &&
            !a.isArchived
        );

        return assignmentsForJudgeAtLevel.reduce((acc, assignment) => {
            const project = projects.find(p => p.id === assignment.projectId);
            if (project) {
                if (!acc[project.category]) {
                    acc[project.category] = new Set<Section>();
                }
                acc[project.category].add(assignment.assignedSection);
            }
            return acc;
        }, {} as Record<string, Set<Section>>);
    }, [judge.id, viewingLevel, assignments, projects]);

    const canAssignNewRole = useMemo(() => {
        for (const sections of Object.values(judgeAssignmentSummary)) {
            if (sections.size === 2) return false;
        }
        return true;
    }, [judgeAssignmentSummary]);

    useEffect(() => {
        if (isOpen) {
            setSelectedCategory('');
            setSelectedSection('Part A');
            setSelectedRole(UserRole.JUDGE);
            setError('');
            setConfirmState(null);
        }
    }, [isOpen]);
    
    const checkCoordinatorExists = (category: string, excludeJudgeId?: string): { exists: boolean, name?: string } => {
        const projectsInCategory = projects.filter(p => p.category === category && p.currentLevel === viewingLevel);
        if (projectsInCategory.length === 0) return { exists: false };
        
        const projectIdsInCategory = new Set(projectsInCategory.map(p => p.id));
        
        const assignmentsForCategory = assignments.filter(a => 
            projectIdsInCategory.has(a.projectId) && 
            a.competitionLevel === viewingLevel &&
            !a.isArchived
        );

        const assignmentsByJudge: Record<string, Set<Section>> = assignmentsForCategory.reduce((acc, assignment) => {
            if (excludeJudgeId && assignment.judgeId === excludeJudgeId) {
                return acc;
            }
            if (!acc[assignment.judgeId]) {
                acc[assignment.judgeId] = new Set<Section>();
            }
            acc[assignment.judgeId].add(assignment.assignedSection);
            return acc;
        }, {} as Record<string, Set<Section>>);


        for (const judgeId in assignmentsByJudge) {
            const sections = assignmentsByJudge[judgeId];
            if ((sections as Set<string>).size === 2) {
                const existingCoordinator = users.find(u => u.id === judgeId);
                return { exists: true, name: existingCoordinator?.name || 'A user' };
            }
        }
        return { exists: false };
    };

    const handleAssign = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!user) return;

        const permission = checkAssignmentPermission(user, judge);
        if (!permission.allowed) {
            setError(permission.message);
            showNotification(permission.message, 'error', 8000);
            return;
        }

        if (!selectedCategory) {
            setError('Please select a category.');
            return;
        }
        
        if (!canAssignNewRole) {
            const coordinatorCategory = Object.entries(judgeAssignmentSummary).find(([_, sections]) => sections.size === 2)?.[0];
            const errorMessage = `Cannot assign new roles. This user is already the Coordinator for '${coordinatorCategory}' at this level.`;
            setError(errorMessage);
            showNotification(errorMessage, 'error', 8000);
            return;
        }

        if (selectedRole === UserRole.COORDINATOR) {
            if (Object.keys(judgeAssignmentSummary).length > 0) {
                const errorMessage = `This user already has judging assignments. To make them a Coordinator, please remove all their current assignments for this level first.`;
                setError(errorMessage);
                showNotification(errorMessage, 'error', 8000);
                return;
            }
            const coordinatorCheck = checkCoordinatorExists(selectedCategory);
            if (coordinatorCheck.exists) {
                const errorMessage = `Cannot assign coordinator. '${coordinatorCheck.name}' is already coordinating the '${selectedCategory}' category for this level.`;
                setError(errorMessage);
                showNotification(errorMessage, 'error', 8000);
                return;
            }

            await assignJudgeToSectionForLevel(judge.id, selectedCategory, 'Part A', viewingLevel);
            await assignJudgeToSectionForLevel(judge.id, selectedCategory, 'Part B & C', viewingLevel);

            const updatedRoles = Array.from(new Set([...judge.roles.filter(r => r !== UserRole.JUDGE), UserRole.COORDINATOR]));
            await updateUserInList({ ...judge, roles: updatedRoles, coordinatedCategory: selectedCategory });

            showNotification(`Assigned ${judge.name} to coordinate '${selectedCategory}' for ${viewingLevel}.`, 'success');

        } else { // Assigning as Judge
            for (const [category, sections] of Object.entries(judgeAssignmentSummary)) {
                if (sections.has(selectedSection)) {
                    const errorMessage = `Cannot assign. This judge is already assigned to ${selectedSection} in the '${category}' category. A judge cannot be assigned the same section across different categories.`;
                    setError(errorMessage);
                    showNotification(errorMessage, 'error', 8000);
                    return;
                }
            }

            const projectsToAssign = projects.filter(p => p.category === selectedCategory && p.currentLevel === viewingLevel && !p.isEliminated);
            if (projectsToAssign.length > 0) {
                const assignmentsForCategory = assignments.filter(a => {
                    const project = projects.find(p => p.id === a.projectId);
                    return project && project.category === selectedCategory && a.competitionLevel === viewingLevel && !a.isArchived;
                });
        
                const assignmentsByJudge = new Map<string, Set<Section>>();
                for (const assignment of assignmentsForCategory) {
                    if (!assignmentsByJudge.has(assignment.judgeId)) {
                        assignmentsByJudge.set(assignment.judgeId, new Set());
                    }
                    assignmentsByJudge.get(assignment.judgeId)!.add(assignment.assignedSection);
                }
                
                const coordinatorIds = new Set<string>();
                for (const [judgeId, sections] of assignmentsByJudge.entries()) {
                    if (sections.size === 2) coordinatorIds.add(judgeId);
                }
        
                for (const project of projectsToAssign) {
                    const assignmentsForProjectSection = assignments.filter(a => a.projectId === project.id && a.assignedSection === selectedSection && a.competitionLevel === viewingLevel && !a.isArchived);
                    const regularJudgeIds = new Set(assignmentsForProjectSection.filter(a => !coordinatorIds.has(a.judgeId)).map(a => a.judgeId));
        
                    if (!regularJudgeIds.has(judge.id) && regularJudgeIds.size >= 2) {
                        const existingJudges = users.filter(u => regularJudgeIds.has(u.id)).map(u => u.name).join(', ');
                        const errorMessage = `Cannot assign judge. Project "${project.title}" for ${selectedSection} is already fully assigned to: ${existingJudges}. A maximum of 2 regular judges are allowed.`;
                        setError(errorMessage);
                        showNotification(errorMessage, 'error', 8000);
                        return;
                    }
                }
            }
            
            const result = await assignJudgeToSectionForLevel(judge.id, selectedCategory, selectedSection, viewingLevel);
            showNotification(result.message, result.success ? 'success' : 'error');
        }
        
        setSelectedCategory('');
    };

    const handleAddSection = async (category: string, existingSections: Section[]) => {
        if (existingSections.length !== 1) return;
        if (!user) return;
        
        const permission = checkAssignmentPermission(user, judge);
        if (!permission.allowed) {
            showNotification(permission.message, 'error', 8000);
            return;
        }

        if (Object.keys(judgeAssignmentSummary).length > 1) {
            showNotification("Cannot promote to Coordinator. This user has assignments in other categories. Please remove other assignments first.", 'error', 8000);
            return;
        }
        
        const sectionToAdd = existingSections[0] === 'Part A' ? 'Part B & C' : 'Part A';
        
        const coordinatorCheck = checkCoordinatorExists(category, judge.id);
        if (coordinatorCheck.exists) {
            const errorMessage = `Cannot promote to coordinator. '${coordinatorCheck.name}' is already coordinating the '${category}' category for this level.`;
            showNotification(errorMessage, 'error', 8000);
            return;
        }

        const result = await assignJudgeToSectionForLevel(judge.id, category, sectionToAdd, viewingLevel);
        
        if(result.success) {
            const updatedRoles = Array.from(new Set([...judge.roles.filter(r => r !== UserRole.JUDGE), UserRole.COORDINATOR]));
            await updateUserInList({ ...judge, roles: updatedRoles, coordinatedCategory: category });
            showNotification(`Promoted ${judge.name} to Coordinator for '${category}'.`, 'success');
        } else {
            showNotification(result.message, 'error');
        }
    };
    
    const handleRemoveCategoryAssignments = (category: string) => {
        if (!user) return;
        const permission = checkAssignmentPermission(user, judge);
        if (!permission.allowed) {
            showNotification(permission.message, 'error', 8000);
            return;
        }

        const isSuperAdmin = user.currentRole === UserRole.SUPER_ADMIN;

        const projectsInCategory = projects.filter(p => p.category === category && p.currentLevel === viewingLevel);
        const projectIdsInCategory = new Set(projectsInCategory.map(p => p.id));

        const hasSubmittedScore = assignments.some(a =>
            a.judgeId === judge.id &&
            projectIdsInCategory.has(a.projectId) &&
            a.competitionLevel === viewingLevel &&
            (a.status === ProjectStatus.COMPLETED || a.score != null)
        );

        if (hasSubmittedScore && !isSuperAdmin) {
            showNotification(`Cannot unassign. ${judge.name} has already submitted scores in the '${category}' category. Only a Super Admin can perform this action.`, 'error', 8000);
            return;
        }

        setConfirmState({
            isOpen: true,
            title: "Confirm Assignment Removal",
            message: `Are you sure you want to remove all of ${judge.name}'s assignments for the '${category}' category at the ${viewingLevel} level? ${hasSubmittedScore ? 'WARNING: This user has already submitted scores. Removing assignments may affect final results and rankings. This action cannot be undone.' : ''}`,
            onConfirm: async () => {
                await unassignJudgeFromSectionForLevel(judge.id, category, 'Part A', viewingLevel);
                await unassignJudgeFromSectionForLevel(judge.id, category, 'Part B & C', viewingLevel);

                const remainingAssignments = { ...judgeAssignmentSummary };
                delete remainingAssignments[category];
                
                let isStillCoordinator = false;
                for (const sections of Object.values(remainingAssignments)) {
                    if (sections.size === 2) {
                        isStillCoordinator = true;
                        break;
                    }
                }

                if (!isStillCoordinator && judge.roles.includes(UserRole.COORDINATOR)) {
                    const baseRoles = judge.roles.filter(r => r !== UserRole.COORDINATOR);
                    const hasAdminRole = baseRoles.some(r => ADMIN_ROLES.includes(r));
                    const updatedRoles = hasAdminRole ? baseRoles : Array.from(new Set([...baseRoles, UserRole.JUDGE]));
                    await updateUserInList({ ...judge, roles: updatedRoles, coordinatedCategory: undefined });
                    showNotification(`${judge.name}'s role has been set to Judge.`, 'info');
                }
                
                showNotification(`All assignments for '${category}' at the ${viewingLevel} level have been cleared for ${judge.name}.`, 'success');
                setConfirmState(null);
            }
        });
    };

    const handleRemoveSection = (category: string, section: Section) => {
        if (!user) return;
        const permission = checkAssignmentPermission(user, judge);
        if (!permission.allowed) {
            showNotification(permission.message, 'error', 8000);
            return;
        }

        const isSuperAdmin = user.currentRole === UserRole.SUPER_ADMIN;

        const projectsInCategory = projects.filter(p => p.category === category && p.currentLevel === viewingLevel);
        const projectIdsInCategory = new Set(projectsInCategory.map(p => p.id));

        const hasSubmittedScore = assignments.some(a =>
            a.judgeId === judge.id &&
            projectIdsInCategory.has(a.projectId) &&
            a.assignedSection === section &&
            a.competitionLevel === viewingLevel &&
            (a.status === ProjectStatus.COMPLETED || a.score != null)
        );

        if (hasSubmittedScore && !isSuperAdmin) {
            showNotification(`Cannot unassign. ${judge.name} has already submitted scores for ${section} in the '${category}' category. Only a Super Admin can perform this action.`, 'error', 8000);
            return;
        }
        
        setConfirmState({
            isOpen: true,
            title: "Confirm Section Removal",
            message: `Are you sure you want to unassign ${judge.name} from ${section} for the '${category}' category? ${hasSubmittedScore ? 'WARNING: This will remove their submitted scores. This action cannot be undone.' : ''}`,
            onConfirm: async () => {
                await unassignJudgeFromSectionForLevel(judge.id, category, section, viewingLevel);
                
                const wasCoordinator = judge.roles.includes(UserRole.COORDINATOR);
                const currentSectionsForCategory = judgeAssignmentSummary[category];
                if (wasCoordinator && currentSectionsForCategory && currentSectionsForCategory.size === 2) {
                    const baseRoles = judge.roles.filter(r => r !== UserRole.COORDINATOR);
                    const hasAdminRole = baseRoles.some(r => ADMIN_ROLES.includes(r));
                    const updatedRoles = hasAdminRole ? baseRoles : Array.from(new Set([...baseRoles, UserRole.JUDGE]));
                    await updateUserInList({ ...judge, roles: updatedRoles, coordinatedCategory: undefined });
                    showNotification(`${judge.name}'s role has been demoted to Judge for '${category}'.`, 'info');
                }

                showNotification(`${section} assignment for '${category}' removed from ${judge.name}.`, 'success');
                setConfirmState(null);
            }
        });
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Assignments for ${judge.name}`} size="lg">
            <div className="space-y-6">
                {canManage && (
                     <form onSubmit={handleAssign} className="p-4 border dark:border-gray-700 rounded-lg space-y-4">
                        <h3 className="font-semibold text-lg">Add New Assignment</h3>
                        {error && <p className="text-red-500 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                <label htmlFor="role-select" className="block text-sm font-medium mb-1">Assign as</label>
                                <select id="role-select" value={selectedRole} onChange={e => setSelectedRole(e.target.value as any)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600" disabled={!canAssignNewRole}>
                                    <option value={UserRole.JUDGE}>Judge</option>
                                    <option value={UserRole.COORDINATOR}>Coordinator</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="category-select" className="block text-sm font-medium mb-1">Category</label>
                                <select id="category-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600">
                                    <option value="" disabled>-- Select Category --</option>
                                    {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="section-select" className="block text-sm font-medium mb-1">Section</label>
                                <select id="section-select" value={selectedSection} onChange={e => setSelectedSection(e.target.value as Section)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600" disabled={selectedRole === UserRole.COORDINATOR}>
                                    {SECTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="text-right">
                            <Button type="submit">Assign</Button>
                        </div>
                    </form>
                )}

                <div>
                    <h3 className="font-semibold text-lg mb-2">Current Assignments for <span className="text-primary">{viewingLevel}</span> Level</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {Object.entries(judgeAssignmentSummary).length > 0 ? (
                            Object.entries(judgeAssignmentSummary).map(([category, sectionsSet]) => {
                                const sections = Array.from(sectionsSet);
                                const isCoordinatorForCategory = sections.length === 2;
                                return (
                                    <div key={category} className={`p-4 rounded-lg flex justify-between items-start md:items-center gap-4 ${
                                        isCoordinatorForCategory ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800'
                                    }`}>
                                        <div>
                                            <p className="font-bold text-lg text-text-light dark:text-text-dark">{category}</p>
                                            {isCoordinatorForCategory ? (
                                                <span className="text-sm text-primary font-semibold flex items-center gap-1"><CheckCircle size={14}/> Coordinating all sections</span>
                                            ) : (
                                                <ul className="list-disc list-inside mt-2 space-y-1">
                                                    {sections.map(section => (
                                                        <li key={section} className="font-medium text-text-light dark:text-text-dark ml-2 flex items-center gap-2">
                                                            {section}
                                                            {canManage && <button onClick={() => handleRemoveSection(category, section)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        {canManage && (
                                            <div className="flex flex-col items-end gap-2">
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50" onClick={() => handleRemoveCategoryAssignments(category)}>
                                                    Remove All for Category
                                                </Button>
                                                {!isCoordinatorForCategory && (
                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => handleAddSection(category, sections)}>
                                                        <PlusCircle size={14}/> Add other section & promote to Coordinator
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-center text-text-muted-light dark:text-text-muted-dark py-4">No assignments for this competition level.</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
            {confirmState?.isOpen && (
                <ConfirmationModal
                    isOpen={confirmState.isOpen}
                    onClose={() => setConfirmState(null)}
                    onConfirm={confirmState.onConfirm}
                    title={confirmState.title}
                    confirmVariant="destructive"
                >
                    {confirmState.message}
                </ConfirmationModal>
            )}
        </Modal>
    );
};

export default JudgeCategoryAssignmentModal;
