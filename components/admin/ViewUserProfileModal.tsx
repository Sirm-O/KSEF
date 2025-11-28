import React, { useContext, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { User, UserRole, Project, JudgeAssignment, CompetitionLevel } from '../../types';
import { AppContext } from '../../context/AppContext';
import { Building, FileText, FolderKanban, Globe, Home, Map as MapIcon, MapPin } from 'lucide-react';

interface ViewUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const InfoField: React.FC<{ label: string; value?: string | string[] | null }> = ({ label, value }) => {
    if (!value && !(Array.isArray(value) && value.length > 0)) return null;
    const displayValue = Array.isArray(value) ? value.join(', ') : value;
    return (
        <div>
            <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">{label}</label>
            <p className="mt-1 p-2 w-full bg-gray-100 dark:bg-gray-800 rounded-md text-text-light dark:text-text-dark">{displayValue || 'N/A'}</p>
        </div>
    );
};

const ViewUserProfileModal: React.FC<ViewUserProfileModalProps> = ({ isOpen, onClose, user }) => {
    const { assignments, projects, user: currentUser } = useContext(AppContext);

    const isJudgeOrCoordinator = user.roles.some(r => [UserRole.JUDGE, UserRole.COORDINATOR].includes(r));
    const hasPersonalGeo = user.roles.some(r => r !== UserRole.NATIONAL_ADMIN && r !== UserRole.SUPER_ADMIN);
    const hasWorkGeo = user.roles.some(r => r === UserRole.JUDGE || r === UserRole.COORDINATOR);

    const currentAssignments = useMemo(() => {
        if (!isJudgeOrCoordinator || !currentUser) return [];

        const roleToLevelMap: { [key in UserRole]?: CompetitionLevel } = {
            [UserRole.SUB_COUNTY_ADMIN]: CompetitionLevel.SUB_COUNTY,
            [UserRole.COUNTY_ADMIN]: CompetitionLevel.COUNTY,
            [UserRole.REGIONAL_ADMIN]: CompetitionLevel.REGIONAL,
            [UserRole.NATIONAL_ADMIN]: CompetitionLevel.NATIONAL,
            [UserRole.SUPER_ADMIN]: CompetitionLevel.NATIONAL,
        };
        const adminLevel = roleToLevelMap[currentUser.currentRole];
        if (!adminLevel) return [];

        const summary = new Map<string, { sections: Set<string>; total: number; completed: number }>();
        
        const activeJudgeAssignments = assignments.filter(a => a.judgeId === user.id && !a.isArchived);

        for (const assignment of activeJudgeAssignments) {
            const project = projects.find(p => p.id === assignment.projectId);

            if (project && project.currentLevel === adminLevel) {
                if (!summary.has(project.category)) {
                    summary.set(project.category, { sections: new Set(), total: 0, completed: 0 });
                }
                const categoryData = summary.get(project.category)!;
                categoryData.sections.add(assignment.assignedSection);
            }
        }
        
        for (const [category, data] of summary.entries()) {
            const assignmentsForCategoryAndLevel = activeJudgeAssignments.filter(a => {
                const proj = projects.find(p => p.id === a.projectId);
                return proj && proj.category === category && proj.currentLevel === adminLevel;
            });
            
            data.total = assignmentsForCategoryAndLevel.length;
            data.completed = assignmentsForCategoryAndLevel.filter(a => a.status === 'Completed').length;
        }

        return Array.from(summary.entries()).map(([category, data]) => ({
            category,
            sections: Array.from(data.sections).sort(),
            totalAssignments: data.total,
            completedAssignments: data.completed
        }));

    }, [isJudgeOrCoordinator, user.id, assignments, projects, currentUser]);


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Viewing Profile: ${user.name}`} size="lg">
            <div className="space-y-6">
                <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                    <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">User Details</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoField label="Full Name" value={user.name} />
                        <InfoField label="Email Address" value={user.email} />
                        <InfoField label="Roles" value={user.roles} />
                        <InfoField label="Active Role" value={user.currentRole} />
                    </div>
                </fieldset>

                {hasPersonalGeo && (
                     <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">Personal Information & Location</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <InfoField label="School / Institution" value={user.school} />
                             <InfoField label="Phone Number" value={user.phoneNumber} />
                             <InfoField label="Region" value={user.region} />
                             <InfoField label="County" value={user.county} />
                             <InfoField label="Sub-County" value={user.subCounty} />
                             <InfoField label="Zone" value={user.zone} />
                        </div>
                    </fieldset>
                )}
                
                {hasWorkGeo && (
                     <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">Work Jurisdiction</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <InfoField label="Work Region" value={user.workRegion} />
                             <InfoField label="Work County" value={user.workCounty} />
                             <InfoField label="Work Sub-County" value={user.workSubCounty} />
                        </div>
                    </fieldset>
                )}
                
                {isJudgeOrCoordinator && (
                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">Current Stage Assignments & Progress</legend>
                        {currentAssignments.length > 0 ? (
                            <div className="space-y-3">
                                {currentAssignments.map(asgn => (
                                    <div key={asgn.category} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <h4 className="font-bold text-text-light dark:text-text-dark">{asgn.category}</h4>
                                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Assigned Sections: {asgn.sections.join(', ')}</p>
                                        <div className="mt-2">
                                            <p className="text-xs font-semibold">Judging Progress</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2.5">
                                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${asgn.totalAssignments > 0 ? (asgn.completedAssignments / asgn.totalAssignments) * 100 : 0}%` }}></div>
                                                </div>
                                                <span className="text-xs font-mono">{asgn.completedAssignments} / {asgn.totalAssignments}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <p className="text-center text-text-muted-light dark:text-text-muted-dark py-4">No assignments for the current competition stage.</p>
                        )}
                    </fieldset>
                )}

                <div className="flex justify-end pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ViewUserProfileModal;