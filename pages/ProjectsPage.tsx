import React, { useState, useContext, useMemo, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { AppContext } from '../context/AppContext';
import { Project, ProjectStatus, UserRole, CompetitionLevel } from '../types';
import { Settings, CheckCircle, Clock, Hourglass, AlertTriangle, Archive, List, Info, FilterX } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';
import { analyzeAbstract } from '../utils/aiService';
import { checkPlagiarism } from '../utils/plagiarismService';
import { RefreshCw, Wand2 } from 'lucide-react';

const ManageProjectModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
    const { users, assignments, calculateProjectScores, viewingLevel } = useContext(AppContext);

    const scores = calculateProjectScores(project.id, viewingLevel);

    const projectAssignments = assignments.filter(a => a.projectId === project.id);
    const assignmentsA = projectAssignments.filter(a => a.assignedSection === 'Part A');
    const assignmentsBC = projectAssignments.filter(a => a.assignedSection === 'Part B & C');

    const SectionAssignments: React.FC<{ title: string, assignments: typeof assignmentsA }> = ({ title, assignments }) => (
        <div className="border-t dark:border-gray-700 pt-4">
            <h4 className="font-semibold text-md text-primary">{title}</h4>
            {assignments.length > 0 ? (
                <ul className="space-y-2 mt-2">
                    {assignments.map(a => {
                        const judge = users.find(u => u.id === a.judgeId);
                        return (
                            <li key={`${a.judgeId}-${a.assignedSection}`} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                <div>
                                    <p className="font-medium">{judge?.name || 'Unknown Judge'}</p>
                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark"><span className="italic">{a.status}</span></p>
                                </div>
                                {a.score !== undefined && <span className="font-bold text-lg">{a.score}</span>}
                            </li>
                        );
                    })}
                </ul>
            ) : <p className="text-text-muted-light dark:text-text-muted-dark mt-1">No judges assigned to this section.</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            {scores.needsArbitration && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Review Required
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        There is a large variance in scores from the judges. This project is pending review by the category coordinator.
                    </p>
                </div>
            )}
            <div>
                <h3 className="font-semibold text-lg text-secondary dark:text-accent-green">Project Details</h3>
                <p><strong>Title:</strong> {project.title}</p>
                <p><strong>School:</strong> {project.school}</p>
                <p><strong>Category:</strong> {project.category}</p>
                <p><strong>Students:</strong> {project.students.join(', ')}</p>
            </div>

            <SectionAssignments title="Part A Judges" assignments={assignmentsA} />
            <SectionAssignments title="Part B & C Judges" assignments={assignmentsBC} />

            <div className="text-right mt-6">
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>
        </div>
    );
};


const RejectProjectModal: React.FC<{ project: Project; onClose: () => void; onConfirm: (reason: string) => void }> = ({ project, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');

    return (
        <div className="space-y-4">
            <p>Are you sure you want to reject the project <strong>{project.title}</strong>?</p>
            <div>
                <label className="block text-sm font-medium mb-1">Reason for Rejection (Visible to Patron)</label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    rows={4}
                    placeholder="e.g., High plagiarism score, AI generated content detected..."
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={!reason.trim()}>Reject Project</Button>
            </div>
        </div>
    );
};

const ProjectsPage: React.FC = () => {
    const { user, projects, assignments, getProjectJudgingProgress, calculateProjectScores, viewingLevel, updateProject, editions, isHistoricalView, geminiApiKey } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [view, setView] = useState<'active' | 'archived' | 'pending'>('pending');

    const location = useLocation();
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState<'all' | 'in-review'>('all');
    const [analyzingProjectId, setAnalyzingProjectId] = useState<string | null>(null);
    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const filterParam = queryParams.get('filter');
        if (filterParam === 'in-review') {
            setStatusFilter('in-review');
        } else {
            setStatusFilter('all');
        }
    }, [location.search]);

    // Calculate if there are any pending projects visible to the user
    const hasPendingProjects = useMemo(() => {
        if (!user) return false;
        return projects.some(p => {
            if (p.status !== ProjectStatus.AWAITING_APPROVAL) return false;
            if (user.currentRole === UserRole.REGIONAL_ADMIN && p.region !== user.region) return false;
            if (user.currentRole === UserRole.COUNTY_ADMIN && (p.county !== user.county || p.region !== user.region)) return false;
            if (user.currentRole === UserRole.SUB_COUNTY_ADMIN && (p.subCounty !== user.subCounty || p.county !== user.county || p.region !== user.region)) return false;
            return true;
        });
    }, [projects, user]);

    // Only show Pending tab at Sub-County level
    const showPendingTab = viewingLevel === CompetitionLevel.SUB_COUNTY;

    // Set default view based on state
    useEffect(() => {
        if (isHistoricalView) {
            setView('archived');
        } else {
            if (showPendingTab && hasPendingProjects) {
                setView('pending');
            } else {
                setView('active');
            }
        }
    }, [isHistoricalView, hasPendingProjects, showPendingTab]);

    const projectsWithStatus = useMemo(() => {
        if (!user) return [];

        const scopedProjects = projects.filter(p => {
            if ([UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole)) {
                return true;
            }
            if (user.currentRole === UserRole.REGIONAL_ADMIN) return p.region === user.region;
            if (user.currentRole === UserRole.COUNTY_ADMIN) return p.county === user.county && p.region === user.region;
            if (user.currentRole === UserRole.SUB_COUNTY_ADMIN) return p.subCounty === user.subCounty && p.county === user.county && p.region === user.region;
            return false;
        });

        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const viewingLevelIndex = levelOrder.indexOf(viewingLevel);

        // This gets the cohort of projects that have *reached* the viewing level.
        const projectsForLevel = scopedProjects.filter(p => {
            // For pending projects, we just want to see them if they are at the current level (or generally in the system if not started)
            // Assuming new projects start at SUB_COUNTY or the lowest level.
            // If viewingLevel is SUB_COUNTY, show all pending.
            // If viewingLevel is higher, maybe only show promoted ones? 
            // Usually registration happens at the lowest level.
            if (view === 'pending') {
                return p.status === ProjectStatus.AWAITING_APPROVAL;
            }

            const projectLevelIndex = levelOrder.indexOf(p.currentLevel);
            if (projectLevelIndex < viewingLevelIndex) return false; // Not yet reached this level
            if (p.isEliminated && projectLevelIndex < viewingLevelIndex) return false; // Eliminated before reaching this level
            return true;
        });

        let relevantProjects = projectsForLevel.filter(p => {
            if (view === 'pending') {
                return p.status === ProjectStatus.AWAITING_APPROVAL;
            }
            if (view === 'active') {
                if (p.status === ProjectStatus.AWAITING_APPROVAL || p.status === ProjectStatus.REJECTED) return false; // Don't show pending or rejected in active
                if (p.currentLevel !== viewingLevel || p.isEliminated) return false;
                // Exclude National projects whose National assignments have been archived (they belong to Completed view)
                if (viewingLevel === CompetitionLevel.NATIONAL && p.currentLevel === CompetitionLevel.NATIONAL) {
                    const natAssignments = assignments.filter(a => a.projectId === p.id && a.competitionLevel === CompetitionLevel.NATIONAL);
                    if (natAssignments.length > 0 && natAssignments.every(a => a.isArchived)) {
                        return false;
                    }
                }
                return true;
            }
            if (view === 'archived') {
                if (p.status === ProjectStatus.AWAITING_APPROVAL || p.status === ProjectStatus.REJECTED) return false;
                const promotedBeyond = levelOrder.indexOf(p.currentLevel) > viewingLevelIndex;
                const eliminatedHere = p.currentLevel === viewingLevel && p.isEliminated;
                // Special handling for National level: once results are archived, winners should show in Completed tab
                let nationalCompleted = false;
                if (viewingLevel === CompetitionLevel.NATIONAL && p.currentLevel === CompetitionLevel.NATIONAL) {
                    const natAssignments = assignments.filter(a => a.projectId === p.id && a.competitionLevel === CompetitionLevel.NATIONAL);
                    if (natAssignments.length > 0 && natAssignments.every(a => a.isArchived)) {
                        nationalCompleted = true;
                    }
                }
                return eliminatedHere || promotedBeyond || nationalCompleted;
            }
            return false;
        });

        if (statusFilter === 'in-review') {
            relevantProjects = relevantProjects.filter(project => {
                const scores = calculateProjectScores(project.id, viewingLevel);
                return scores.needsArbitration;
            });
        }

        return relevantProjects.map(project => {
            const { percentage, statusText } = getProjectJudgingProgress(project.id, viewingLevel);
            const finalScores = calculateProjectScores(project.id, viewingLevel);

            let status: { text: string; icon: React.ReactNode; color: string };

            if (project.status === ProjectStatus.AWAITING_APPROVAL) {
                status = { text: 'Awaiting Approval', icon: <Clock className="w-4 h-4" />, color: 'text-purple-500' };
            } else if (project.isEliminated) {
                status = { text: 'Eliminated', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-500' };
            } else if (levelOrder.indexOf(project.currentLevel) > viewingLevelIndex) {
                status = { text: `Promoted to ${project.currentLevel}`, icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500' };
            } else {
                // Use the new statusText for judging progress
                switch (statusText) {
                    case 'Review Pending':
                        status = { text: 'Review Pending', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-500' };
                        break;
                    case 'Completed':
                        status = { text: 'Completed', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500' };
                        break;
                    case 'In Progress':
                        status = { text: 'In Progress', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-500' };
                        break;
                    case 'Not Started':
                    default:
                        status = { text: 'Not Started', icon: <Hourglass className="w-4 h-4" />, color: 'text-blue-500' };
                        break;
                }
            }

            return {
                ...project,
                completion: percentage,
                judgingStatus: status,
                finalScore: finalScores.isFullyJudged ? finalScores.totalScore : null
            };
        });
    }, [user, projects, getProjectJudgingProgress, calculateProjectScores, view, statusFilter, viewingLevel]);

    const handleManageClick = (project: Project) => {
        setSelectedProject(project);
        setIsModalOpen(true);
    };

    const handleRejectClick = (project: Project) => {
        setSelectedProject(project);
        setIsRejectModalOpen(true);
    };

    const handleApprove = (project: Project) => {
        if (confirm(`Approve project "${project.title}"?`)) {
            updateProject({ ...project, status: ProjectStatus.NOT_STARTED, rejectionReason: undefined });
        }
    };

    const handleRejectConfirm = (reason: string) => {
        if (selectedProject) {
            // Rejecting means setting status to REJECTED and adding a rejection reason.
            updateProject({ ...selectedProject, status: ProjectStatus.REJECTED, rejectionReason: reason });
            setIsRejectModalOpen(false);
            setSelectedProject(null);
        }
    };

    const handleAdminAnalysis = async (project: Project) => {
        if (!project.abstract) {
            alert("This project has no abstract to analyze.");
            return;
        }
        setAnalyzingProjectId(project.id);
        try {
            // Run AI Analysis
            const aiResult = await analyzeAbstract(project.abstract, geminiApiKey);

            // Run Plagiarism Check
            const plagiarismResult = checkPlagiarism(project.abstract, projects.filter(p => p.id !== project.id), editions);

            // Update Project
            updateProject({
                ...project,
                aiAnalysis: aiResult,
                plagiarismScore: plagiarismResult.score,
                plagiarismDetails: plagiarismResult.details
            });

        } catch (error) {
            console.error("Analysis failed", error);
            alert("Analysis failed. Please try again.");
        } finally {
            setAnalyzingProjectId(null);
        }
    };

    const handleBatchAnalysis = async () => {
        const pendingProjects = projectsWithStatus.filter(p =>
            p.status === ProjectStatus.AWAITING_APPROVAL &&
            (!p.aiAnalysis || p.plagiarismScore === undefined) &&
            p.abstract
        );

        if (pendingProjects.length === 0) {
            alert("No pending projects found that require analysis.");
            return;
        }

        if (!confirm(`Found ${pendingProjects.length} projects to analyze. This may take a moment. Proceed?`)) return;

        setIsBatchAnalyzing(true);
        setBatchProgress({ current: 0, total: pendingProjects.length });

        for (let i = 0; i < pendingProjects.length; i++) {
            const project = pendingProjects[i];
            try {
                const aiResult = await analyzeAbstract(project.abstract!, geminiApiKey);
                const plagiarismResult = checkPlagiarism(project.abstract!, projects.filter(p => p.id !== project.id), editions);

                updateProject({
                    ...project,
                    aiAnalysis: aiResult,
                    plagiarismScore: plagiarismResult.score,
                    plagiarismDetails: plagiarismResult.details
                });
            } catch (e) {
                console.error(`Failed to analyze project ${project.title}`, e);
            }
            setBatchProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setIsBatchAnalyzing(false);
        alert("Batch analysis complete.");
    };

    const clearStatusFilter = () => {
        setStatusFilter('all');
        navigate('/projects');
    };

    return (
        <div className="space-y-6">
            <CompetitionLevelSwitcher />
            <Card>
                <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Manage Projects ({viewingLevel})</h1>
                <p className="text-text-muted-light dark:text-text-muted-dark mt-1">
                    View project status, judge assignments, and competition progress for your jurisdiction.
                </p>
            </Card>

            <Card>
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    {showPendingTab && (
                        <Button
                            variant="ghost"
                            onClick={() => setView('pending')}
                            className={`!rounded-b-none ${view === 'pending' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}
                        >
                            <Hourglass className="w-4 h-4 mr-2" /> Pending Approval
                            {projects.filter(p => p.status === ProjectStatus.AWAITING_APPROVAL).length > 0 && (
                                <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">
                                    {projects.filter(p => p.status === ProjectStatus.AWAITING_APPROVAL).length}
                                </span>
                            )}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        onClick={() => setView('active')}
                        className={`!rounded-b-none ${view === 'active' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}
                    >
                        <List className="w-4 h-4 mr-2" /> Active Projects
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setView('archived')}
                        className={`!rounded-b-none ${view === 'archived' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}
                    >
                        <Archive className="w-4 h-4 mr-2" /> Completed
                    </Button>
                    {view === 'pending' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchAnalysis}
                            disabled={isBatchAnalyzing}
                            className="ml-auto mr-4 mb-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                            {isBatchAnalyzing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing ({batchProgress.current}/{batchProgress.total})...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    Analyze All Pending
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {statusFilter === 'in-review' && (
                    <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            <div>
                                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                                    Viewing Projects Pending Review
                                </h3>
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    These projects have a large score variance and require a coordinator to arbitrate.
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={clearStatusFilter} className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                            <FilterX className="w-4 h-4" /> Clear Filter
                        </Button>
                    </div>
                )}

                {view === 'archived' && (
                    <Card className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-400">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                                    Viewing Historical Records
                                </h3>
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    This view shows projects that have completed the competition at your level. The scores displayed are the final, historical scores from when they were judged here, either before being promoted to the next level or after being eliminated.
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">School</th>
                                {view === 'pending' ? (
                                    <>
                                        <th className="px-4 py-3">AI Score</th>
                                        <th className="px-4 py-3">Plagiarism</th>
                                    </>
                                ) : (
                                    <th className="px-4 py-3">Progress</th>
                                )}
                                {view === 'archived' && <th className="px-4 py-3 text-center">Final Score</th>}
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectsWithStatus.length > 0 ? (
                                projectsWithStatus.map(project => (
                                    <tr key={project.id} className="border-b dark:border-gray-700 text-text-light dark:text-text-dark">
                                        <td className="px-4 py-3">
                                            <span className={`flex items-center gap-1 font-semibold ${project.judgingStatus.color}`}>
                                                {project.judgingStatus.icon}
                                                {project.judgingStatus.text}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{project.title}</td>
                                        <td className="px-4 py-3">{project.category}</td>
                                        <td className="px-4 py-3">{project.school}</td>
                                        {view === 'pending' ? (
                                            <>
                                                <td className="px-4 py-3">
                                                    {project.aiAnalysis ? (
                                                        <span className={`font-bold ${project.aiAnalysis.aiScore > 50 ? 'text-red-500' : 'text-green-500'}`}>
                                                            {project.aiAnalysis.aiScore}%
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleAdminAnalysis(project)}
                                                            disabled={analyzingProjectId === project.id || !project.abstract}
                                                            className="text-blue-600 hover:bg-blue-100 flex items-center gap-1"
                                                        >
                                                            {analyzingProjectId === project.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                                                            {analyzingProjectId === project.id ? 'Analyzing...' : 'Analyze'}
                                                        </Button>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {project.plagiarismScore !== undefined ? (
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold ${project.plagiarismScore > 80 ? 'text-red-500' : 'text-green-500'}`}>
                                                                {project.plagiarismScore}%
                                                            </span>
                                                            {project.plagiarismDetails && (
                                                                <div className="mt-1 text-xs text-text-muted-light dark:text-text-muted-dark bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800/50 max-w-[200px]">
                                                                    <p className="font-semibold text-red-600 dark:text-red-400 mb-0.5">Potential Match:</p>
                                                                    <p className="truncate" title={project.plagiarismDetails.matchedProjectTitle}>
                                                                        <span className="font-medium">Title:</span> {project.plagiarismDetails.matchedProjectTitle}
                                                                    </p>
                                                                    <p className="truncate" title={project.plagiarismDetails.school}>
                                                                        <span className="font-medium">School:</span> {project.plagiarismDetails.school}
                                                                    </p>
                                                                    <p>
                                                                        <span className="font-medium">Edition:</span> {project.plagiarismDetails.edition}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : 'N/A'}
                                                </td>
                                            </>
                                        ) : (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                        <div className="bg-primary h-2 rounded-full" style={{ width: `${project.completion}%` }}></div>
                                                    </div>
                                                    <span className="text-xs">{project.completion.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        )}
                                        {view === 'archived' && (
                                            <td className="px-4 py-3 text-center font-bold text-primary">
                                                {project.finalScore !== null ? project.finalScore.toFixed(2) : 'N/A'}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-center">
                                            {view === 'pending' ? (
                                                <div className="flex justify-center gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => handleApprove(project)} className="text-green-600 hover:bg-green-100">
                                                        Approve
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handleRejectClick(project)} className="text-red-600 hover:bg-red-100">
                                                        Reject
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button variant="ghost" size="sm" onClick={() => handleManageClick(project)}>
                                                    <Settings className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={view === 'archived' ? 7 : (view === 'pending' ? 7 : 6)} className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
                                        No projects to display for this view{statusFilter === 'in-review' ? ' with the "In Review" filter' : ''}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isModalOpen && selectedProject && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Manage: ${selectedProject.title}`} size="lg">
                    <ManageProjectModal project={selectedProject} onClose={() => setIsModalOpen(false)} />
                </Modal>
            )}

            {isRejectModalOpen && selectedProject && (
                <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title={`Reject Project: ${selectedProject.title}`} size="md">
                    <RejectProjectModal project={selectedProject} onClose={() => setIsRejectModalOpen(false)} onConfirm={handleRejectConfirm} />
                </Modal>
            )}
        </div>
    );
};

export default ProjectsPage;
