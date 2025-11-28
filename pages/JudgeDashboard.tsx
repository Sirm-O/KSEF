
import React, { useContext, useState, ReactNode, useMemo, useEffect } from 'react';
// FIX: Replaced namespace import for react-router-dom with a named import to resolve module export errors.
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { AppContext } from '../context/AppContext';
import { Project, ProjectStatus, CompetitionLevel, UserRole } from '../types';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { CheckCircle, Clock, Info, AlertTriangle } from 'lucide-react';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';

const JudgeDashboard: React.FC = () => {
    const { user, projects, assignments, activeJudgingInfo, isWithinJudgingHours, getTimeLeftInJudgingSession, theme, isLoading, viewingLevel, overallHighestLevel } = useContext(AppContext);
    // FIX: Replaced ReactRouterDOM.useNavigate with useNavigate from named import.
    const navigate = useNavigate();
    const [confirmation, setConfirmation] = useState<{
        show: boolean;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    const isViewingActiveLevel = viewingLevel === overallHighestLevel;

    const myAssignments = useMemo(() => {
        if (!user || !projects || !assignments || !isViewingActiveLevel) return [];
    
        const projectMap = new Map(projects.map(p => [p.id, p]));
    
        const allAssignmentsForUser = assignments.filter(a => a.judgeId === user.id && !a.isArchived);
    
        const nonConflictedAssignments = allAssignmentsForUser.filter(a => {
            // FIX: Cast map lookup to Project to resolve type inference error.
            const project = projectMap.get(a.projectId) as Project | undefined;
            
            // FIX: Exempt coordinators from conflict of interest rules. They can judge projects from their own school.
            if (project && user.school && user.school === project.school && user.currentRole !== UserRole.COORDINATOR) {
                return false; 
            }
            return true;
        });
    
        // The filter should strictly use the work jurisdiction set by an admin.
        // A judge's personal location should not affect which assignments they see.
        const { workRegion, workCounty, workSubCounty } = user;
    
        // If a judge has no work jurisdiction, they are considered a national-level judge
        // and can see any project they are assigned to, regardless of location.
        if (!workRegion) {
            // Filter only by competition level
            return nonConflictedAssignments.filter(assignment => {
                const project = projectMap.get(assignment.projectId) as Project | undefined;
                // Ensure project exists and is part of the currently viewed competition level
                return project && project.currentLevel === viewingLevel;
            });
        }
    
        // If work jurisdiction is set, filter projects to match that scope.
        return nonConflictedAssignments.filter(assignment => {
            const project = projectMap.get(assignment.projectId) as Project | undefined;
            if (!project || project.currentLevel !== viewingLevel) return false;
    
            // Hierarchical check
            if (workSubCounty) {
                return project.region === workRegion && project.county === workCounty && project.subCounty === workSubCounty;
            }
            if (workCounty) {
                return project.region === workRegion && project.county === workCounty;
            }
            // If only workRegion is set
            return project.region === workRegion;
        });
    
    }, [user, assignments, projects, viewingLevel, isViewingActiveLevel]);

    const handleStartJudgingClick = (project: Project, assignment: (typeof myAssignments)[0]) => {
        // If continuing an in-progress session, no time check is needed.
        if (assignment.status === ProjectStatus.IN_PROGRESS) {
            navigate(`/judge/project/${project.id}?section=${encodeURIComponent(assignment.assignedSection)}`);
            return;
        }

        const timeLeftMs = getTimeLeftInJudgingSession();

        // If starting a new session with less than 5 minutes left, show a warning.
        if (timeLeftMs !== null && timeLeftMs < 5 * 60 * 1000) {
            setConfirmation({
                show: true,
                message: `There are less than 5 minutes remaining in the judging session. You may not have enough time to complete your evaluation. Do you still wish to proceed?`,
                onConfirm: () => {
                    setConfirmation(null);
                    navigate(`/judge/project/${project.id}?section=${encodeURIComponent(assignment.assignedSection)}`);
                }
            });
        } else {
            // Otherwise, proceed to the judging form.
            navigate(`/judge/project/${project.id}?section=${encodeURIComponent(assignment.assignedSection)}`);
        }
    };

    const handleCancelProceed = () => {
        setConfirmation(null);
    };

    const completedCount = myAssignments.filter(a => a.status === ProjectStatus.COMPLETED).length;
    const progress = myAssignments.length > 0 ? (completedCount / myAssignments.length) * 100 : 0;

    const pieData = [
        { name: 'Completed', value: completedCount },
        { name: 'Pending', value: myAssignments.length - completedCount }
    ];
    const COLORS = ['#00C49F', '#FFBB28'];

    const categoryChartData = useMemo(() => {
        if (!myAssignments || !projects) return [];
        const assignmentsByProject = myAssignments.reduce((acc, assignment) => {
            if (!acc[assignment.projectId]) {
                acc[assignment.projectId] = [];
            }
            acc[assignment.projectId].push(assignment);
            return acc;
        }, {} as { [projectId: string]: typeof myAssignments });

        const categoryCounts: { [key: string]: number } = {};

        for (const projectId in assignmentsByProject) {
            const projectAssignments = assignmentsByProject[projectId];
            const allCompleteForProject = projectAssignments.every(a => a.status === ProjectStatus.COMPLETED);
            
            if (allCompleteForProject) {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    categoryCounts[project.category] = (categoryCounts[project.category] || 0) + 1;
                }
            }
        }
        
        return Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
    }, [myAssignments, projects]);

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
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">My Judging Assignments</h2>
            
            <CompetitionLevelSwitcher />

            <Card>
                <h4 className="font-semibold mb-3 text-text-light dark:text-text-dark">Overall Progress ({viewingLevel})</h4>
                <div className="flex items-center gap-4">
                    <span className="font-bold text-2xl text-primary">{progress.toFixed(0)}%</span>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div className="bg-primary h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="text-text-muted-light dark:text-text-muted-dark whitespace-nowrap">{completedCount} / {myAssignments.length} assignments done</span>
                </div>
            </Card>

            <Card>
                {!isViewingActiveLevel ? (
                    <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-500">
                           <Info className="w-8 h-8"/>
                       </div>
                       <h4 className="mt-4 text-lg font-semibold text-text-light dark:text-text-dark">Viewing Past Level</h4>
                       <p className="mt-1 text-text-muted-light dark:text-text-muted-dark">
                           Active judging assignments are only shown for the current competition level.
                       </p>
                   </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Project Title</th>
                                    <th scope="col" className="px-6 py-3">Category</th>
                                    <th scope="col" className="px-6 py-3">Assigned Section</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                    <th scope="col" className="px-6 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myAssignments.map(assignment => {
                                    const project = projects.find(p => p.id === assignment.projectId);
                                    if (!project) return null;

                                    const isLockedByAnotherSession = activeJudgingInfo && (activeJudgingInfo.projectId !== assignment.projectId || activeJudgingInfo.sectionId !== assignment.assignedSection);
                                    const isButtonDisabled = isLockedByAnotherSession || !isWithinJudgingHours;
                                    
                                    let buttonTitle = 'Start Judging';
                                    if (isLockedByAnotherSession) {
                                        buttonTitle = 'Please complete your active judging session first';
                                    } else if (!isWithinJudgingHours) {
                                        buttonTitle = 'Judging is currently closed';
                                    }

                                    const renderStatus = () => {
                                        switch (assignment.status) {
                                            case ProjectStatus.COMPLETED:
                                                return <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-4 h-4"/> Completed</span>;
                                            case ProjectStatus.IN_PROGRESS:
                                                return <span className="flex items-center gap-1 text-yellow-500"><Clock className="w-4 h-4"/> In Progress</span>;
                                            default:
                                                return <span className="text-blue-500">{assignment.status}</span>;
                                        }
                                    };
                                    
                                    return (
                                        <tr key={`${assignment.projectId}-${assignment.assignedSection}`} className="border-b dark:border-gray-700">
                                            <td className="px-6 py-4 font-medium text-text-light dark:text-text-dark">{project.title}</td>
                                            <td className="px-6 py-4 text-text-light dark:text-text-dark">{project.category}</td>
                                            <td className="px-6 py-4 text-text-light dark:text-text-dark">{assignment.assignedSection}</td>
                                            <td className="px-6 py-4">
                                                {renderStatus()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {assignment.status !== ProjectStatus.COMPLETED ? 
                                                <Button 
                                                    onClick={() => handleStartJudgingClick(project, assignment)}
                                                    disabled={isButtonDisabled}
                                                    title={buttonTitle}
                                                >
                                                    {assignment.status === ProjectStatus.IN_PROGRESS ? 'Continue Judging' : 'Start Judging'}
                                                </Button> : 
                                                <Button variant="ghost">View Marks</Button>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <h3 className="text-xl font-bold text-text-light dark:text-text-dark pt-4">Judging Statistics</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h4 className="font-semibold mb-2 text-text-light dark:text-text-dark">Assignments Status</h4>
                     <div className="w-full h-60">
                        <ResponsiveContainer>
                           <RechartsPieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{
                                        backgroundColor: 'rgba(30, 41, 59, 0.8)',
                                        borderColor: '#00A8E8',
                                        color: '#E2E8F0'
                                    }}
                                />
                                <Legend wrapperStyle={{ color: theme === 'dark' ? '#E2E8F0' : '#1E293B' }} />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card>
                    <h4 className="font-semibold mb-2 text-text-light dark:text-text-dark">Completed Projects by Category</h4>
                    {categoryChartData.length > 0 ? (
                        <div className="w-full h-60">
                            <ResponsiveContainer>
                                <BarChart data={categoryChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                                    <XAxis dataKey="name" tick={{ fill: theme === 'dark' ? '#94A3B8' : '#64748B' }} />
                                    <YAxis tick={{ fill: theme === 'dark' ? '#94A3B8' : '#64748B' }} allowDecimals={false} />
                                    <Tooltip 
                                        cursor={{fill: 'rgba(128, 128, 128, 0.1)'}}
                                        contentStyle={{
                                            backgroundColor: 'rgba(30, 41, 59, 0.8)',
                                            borderColor: '#00A8E8',
                                            color: '#E2E8F0'
                                        }}
                                    />
                                    <Bar dataKey="value" fill="#00A8E8" name="Completed Projects" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="w-full h-60 flex items-center justify-center">
                            <p className="text-text-muted-light dark:text-text-muted-dark">No completed projects to show.</p>
                        </div>
                    )}
                </Card>
            </div>
             <Card>
                <h4 className="font-semibold mb-4 text-text-light dark:text-text-dark">Help & Resources</h4>
                <div className="flex flex-col sm:flex-row gap-4">
                    <a href="#" className="text-primary hover:underline">Marking Scheme Guidelines (PDF)</a>
                    <a href="#" className="text-primary hover:underline">FAQ & Technical Support</a>
                </div>
            </Card>

            {confirmation?.show && (
                <ConfirmationModal
                    isOpen={confirmation.show}
                    onClose={handleCancelProceed}
                    onConfirm={confirmation.onConfirm}
                    title="Time Warning"
                    confirmText="Proceed Anyway"
                    cancelText="Go Back"
                    confirmVariant="destructive"
                >
                    {confirmation.message}
                </ConfirmationModal>
            )}
        </div>
    );
};

export default JudgeDashboard;