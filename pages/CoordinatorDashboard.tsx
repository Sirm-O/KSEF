import React, { useContext, useMemo, useState, ReactNode } from 'react';
import { AppContext } from '../context/AppContext';
// FIX: Replaced namespace import for react-router-dom with a named import to resolve module export errors.
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Project, UserRole, ProjectStatus, User, CompetitionLevel } from '../types';
import { AlertTriangle, User as UserIcon, ShieldAlert, Scale, Clock } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';

const CoordinatorDashboard: React.FC = () => {
    const { user, users, projects, assignments, isLoading, viewingLevel, overallHighestLevel } = useContext(AppContext);
    // FIX: Replaced ReactRouterDOM.useNavigate with useNavigate from named import.
    const navigate = useNavigate();
    
    const isViewingActiveLevel = viewingLevel === overallHighestLevel;

    const arbitrationTasks = useMemo(() => {
        if (!user || !user.coordinatedCategory || !users || !projects || !assignments || !isViewingActiveLevel) return [];
    
        // FIX: Explicitly type the userMap to prevent type inference errors downstream.
        const userMap = new Map<string, User>(users.map(u => [u.id, u]));
    
        const tasks: { project: Project; reason: string; section: 'Part A' | 'Part B & C'; icon: React.ReactNode }[] = [];
    
        const relevantProjects = projects.filter(p => p.category === user.coordinatedCategory && p.currentLevel === viewingLevel && !p.isEliminated);
    
        for (const project of relevantProjects) {
            const projectAssignments = assignments.filter(a => a.projectId === project.id && !a.isArchived);
    
            // Check for Conflict of Interest
            for (const assignment of projectAssignments) {
                // FIX: Cast map lookup to User to resolve type inference error.
                const judge = userMap.get(assignment.judgeId);
                
                // FIX: Exempt coordinators from conflict of interest flagging, as they are special judges.
                // A conflict is only flagged if the judge is from the same school AND is not a coordinator.
                if (judge && !judge.roles.includes(UserRole.COORDINATOR) && judge.school && project.school && judge.school === project.school) {
                    const hasCoordinatorJudged = projectAssignments.some(a => 
                        a.judgeId === user.id && 
                        a.assignedSection === assignment.assignedSection && 
                        a.status === ProjectStatus.COMPLETED
                    );
                    if (!hasCoordinatorJudged) {
                        tasks.push({ 
                            project, 
                            // FIX: Correctly access property on typed object.
                            reason: `Conflict of Interest: ${judge.name}`, 
                            section: assignment.assignedSection,
                            icon: <ShieldAlert className="w-5 h-5 text-orange-500" />
                        });
                    }
                }
            }
    
            // Check for Mark Variance
            for (const section of ['Part A', 'Part B & C'] as const) {
                const sectionAssignments = projectAssignments.filter(a => a.assignedSection === section && a.status === ProjectStatus.COMPLETED);
                // FIX: Cast map lookup to User to resolve type inference error.
                const regularJudges = sectionAssignments.filter(a => userMap.get(a.judgeId)?.currentRole !== UserRole.COORDINATOR);
                
                if (regularJudges.length >= 2) {
                    if (Math.abs((regularJudges[0].score ?? 0) - (regularJudges[1].score ?? 0)) >= 5) {
                        // FIX: Cast map lookup to User to resolve type inference error.
                        const hasCoordinatorJudged = sectionAssignments.some(a => userMap.get(a.judgeId)?.currentRole === UserRole.COORDINATOR);
                        if (!hasCoordinatorJudged) {
                            tasks.push({ 
                                project, 
                                reason: `Mark Variance (>=5 points)`, 
                                section,
                                icon: <Scale className="w-5 h-5 text-red-500" />
                            });
                        }
                    }
                }
            }

            // Check for projects explicitly assigned for review (e.g., due to timeout)
            const reviewAssignments = projectAssignments.filter(a => 
                a.judgeId === user.id && 
                a.status === ProjectStatus.REVIEW_PENDING
            );

            for (const assignment of reviewAssignments) {
                let reasonText = 'Flagged for manual review';
                if (assignment.comments?.toLowerCase().includes('timed out') || assignment.comments?.toLowerCase().includes('timeout')) {
                    reasonText = 'Judge session timed out';
                }

                // Check if the coordinator has already completed this, just in case.
                const hasCoordinatorJudged = projectAssignments.some(a => 
                    a.judgeId === user.id && 
                    a.assignedSection === assignment.assignedSection && 
                    a.status === ProjectStatus.COMPLETED
                );
                
                if (!hasCoordinatorJudged) {
                    tasks.push({
                        project,
                        reason: reasonText,
                        section: assignment.assignedSection,
                        icon: <Clock className="w-5 h-5 text-blue-500" />
                    });
                }
            }
        }
        
        return Array.from(new Map(tasks.map(t => [`${t.project.id}-${t.section}`, t])).values());
    
    }, [projects, assignments, users, user, viewingLevel, overallHighestLevel, isViewingActiveLevel]);

    const stats = {
        conflict: arbitrationTasks.filter(t => t.reason.startsWith('Conflict')).length,
        variance: arbitrationTasks.filter(t => t.reason.startsWith('Mark')).length,
        total: arbitrationTasks.length
    };

    // Show loading spinner while data is being fetched
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-text-muted-light dark:text-text-muted-dark">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    // Safety check for user
    if (!user) {
        return (
            <Card>
                <p className="text-text-muted-light dark:text-text-muted-dark">Unable to load user data. Please try refreshing the page.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Coordinator Arbitration Dashboard</h2>
                {user?.coordinatedCategory && (
                    <p className="text-lg text-text-muted-light dark:text-text-muted-dark">
                        Managing: <span className="font-semibold text-primary">{user.coordinatedCategory} Category</span>
                    </p>
                )}
            </div>
            
            <CompetitionLevelSwitcher />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardCard title="Total Arbitration Tasks" value={stats.total.toString()} icon={<AlertTriangle />} />
                <DashboardCard title="Conflicts of Interest" value={stats.conflict.toString()} icon={<ShieldAlert />} />
                <DashboardCard title="Score Variances" value={stats.variance.toString()} icon={<Scale />} />
            </div>

            <Card>
                <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">My Arbitration Tasks</h3>
                {!isViewingActiveLevel ? (
                    <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-500">
                           <UserIcon className="w-8 h-8"/>
                       </div>
                       <h4 className="mt-4 text-lg font-semibold text-text-light dark:text-text-dark">Viewing Past Level</h4>
                       <p className="mt-1 text-text-muted-light dark:text-text-muted-dark">
                           Arbitration tasks are only available for the currently active competition level.
                       </p>
                   </div>
                ) : arbitrationTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-800/50 text-text-muted-light dark:text-text-muted-dark">
                                <tr>
                                    <th className="px-4 py-3 text-left">Project Title</th>
                                    <th className="px-4 py-3 text-left">Section</th>
                                    <th className="px-4 py-3 text-left">Reason for Review</th>
                                    <th className="px-4 py-3 text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {arbitrationTasks.map(task => (
                                    <tr key={`${task.project.id}-${task.section}`} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-3 font-medium text-text-light dark:text-text-dark">{task.project.title}</td>
                                        <td className="px-4 py-3 font-semibold text-text-light dark:text-text-dark">{task.section}</td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-2 text-text-light dark:text-text-dark">
                                                {task.icon}
                                                {task.reason}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button 
                                                variant="secondary" 
                                                size="sm"
                                                onClick={() => navigate(`/judge/project/${task.project.id}?review=true&section=${encodeURIComponent(task.section)}`)}
                                            >
                                                Arbitrate Score
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                         <div className="mx-auto w-16 h-16 flex items-center justify-center bg-green-100 dark:bg-green-900/40 rounded-full text-green-500">
                            <UserIcon className="w-8 h-8"/>
                        </div>
                        <h4 className="mt-4 text-lg font-semibold text-text-light dark:text-text-dark">All Clear!</h4>
                        <p className="mt-1 text-text-muted-light dark:text-text-muted-dark">
                            There are currently no projects in your category that require arbitration.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CoordinatorDashboard;