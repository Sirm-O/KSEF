import React, { useContext, useState, useMemo, useEffect } from 'react';
// FIX: Replaced namespace import for react-router-dom with a named import to resolve module export errors.
import { useNavigate } from 'react-router-dom';
import { Plus, Download, BarChart2, Edit, Trash2, Clock, Eye, Hourglass, FilterX, AlertTriangle, Trophy, School, FileText, Award, ChevronDown, Award as CertificateIcon } from 'lucide-react';
import { AppContext, ProjectScores } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DashboardCard from '../components/DashboardCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { Project, CompetitionLevel, JudgingDetails, CategoryStats, JudgingCriterion, ProjectStatus } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { SCORE_SHEET, ROBOTICS_SCORE_SHEET } from '../constants';
import { addCertificatePage } from '../components/reports/CertificateGenerator';


// --- NEW LOGIC: Pre-calculate criteria ID sets for score breakdown ---
const bcCriteria = SCORE_SHEET.find(s => s.id === 'BC')?.criteria || [];
const bCriteriaIds = new Set<number>(bcCriteria.filter(c => c.originalSection === 'B').map(c => c.id));
const cCriteriaIds = new Set<number>(bcCriteria.filter(c => c.originalSection === 'C').map(c => c.id));

const roboticsBCriteria = ROBOTICS_SCORE_SHEET.find(s => s.id === 'B')?.criteria || [];
const roboticsBCriteriaIds = new Set<number>(roboticsBCriteria.map(c => c.id));
const roboticsMissionsSection = ROBOTICS_SCORE_SHEET.find(s => s.id === 'C') as any;
const roboticsMissions = roboticsMissionsSection?.roboticsMissions;
// FIX: Explicitly type `new Set()` to `new Set<number>()` to prevent type inference issues when the source array is empty.
const roboticsCCriteriaIds = roboticsMissions ? new Set<number>([...roboticsMissions.compulsory.map((m: any) => m.id), ...roboticsMissions.studentGenerated.map((m: any) => m.id)]) : new Set<number>();


const criteriaMap = new Map<number, JudgingCriterion>();
SCORE_SHEET.forEach(section => {
    section.criteria.forEach(criterion => {
        criteriaMap.set(criterion.id, criterion);
    });
});
ROBOTICS_SCORE_SHEET.forEach(section => {
    if (section.criteria) {
        section.criteria.forEach(criterion => {
            if (!criteriaMap.has(criterion.id)) {
                criteriaMap.set(criterion.id, criterion);
            }
        });
    }
    if (section.isRoboticsMissions && section.roboticsMissions) {
        const missions = [...section.roboticsMissions.compulsory, ...section.roboticsMissions.studentGenerated];
        missions.forEach(mission => {
            if (!criteriaMap.has(mission.id)) {
                criteriaMap.set(mission.id, {
                    id: mission.id,
                    text: mission.text,
                    details: 'Robotics Mission',
                    maxScore: mission.maxScore,
                });
            }
        });
    }
});


const ScoreBreakdownTable: React.FC<{ breakdown: { [key: number]: number } }> = ({ breakdown }) => {
    if (Object.keys(breakdown).length === 0) return null;

    return (
        <div className="overflow-x-auto mt-2 border dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-text-muted-light dark:text-text-muted-dark">Criterion</th>
                        <th className="px-3 py-2 text-center font-medium text-text-muted-light dark:text-text-muted-dark">Score</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(breakdown).map(([criterionId, score]) => {
                        const criterion = criteriaMap.get(Number(criterionId));
                        if (!criterion) return null;
                        return (
                            <tr key={criterionId} className="border-t dark:border-gray-700">
                                <td className="px-3 py-2">
                                    <p className="text-text-light dark:text-text-dark">{criterion.text}</p>
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{criterion.details}</p>
                                </td>
                                <td className="px-3 py-2 text-center font-semibold text-primary">{score} / {criterion.maxScore}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// --- NEW ACCORDION COMPONENT FOR HISTORY VIEW ---
const AccordionItem: React.FC<{
    title: string;
    children: React.ReactNode;
    startOpen?: boolean;
}> = ({ title, children, startOpen = false }) => {
    const [isOpen, setIsOpen] = useState(startOpen);
    return (
        <div className="border-b dark:border-gray-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-4 text-left font-semibold text-lg"
            >
                <span>{title}</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] py-4' : 'max-h-0'}`}>
                {children}
            </div>
        </div>
    );
};

const JudgeFeedbackCard: React.FC<{ detail: JudgingDetails; project: Project }> = ({ detail, project }) => {
    let scoreB: number | null = null;
    let scoreC: number | null = null;
    const partBBreakdown: { [key: number]: number } = {};
    const partCBreakdown: { [key: number]: number } = {};

    if (detail.assignedSection === 'Part B & C' && detail.scoreBreakdown) {
        const isRobotics = project.category === 'Robotics';
        const currentBCriteriaIds = isRobotics ? roboticsBCriteriaIds : bCriteriaIds;
        const currentCCriteriaIds = isRobotics ? roboticsCCriteriaIds : cCriteriaIds;

        scoreB = 0;
        scoreC = 0;

        for (const key in detail.scoreBreakdown) {
            const criterionId = parseInt(key);
            const score = detail.scoreBreakdown[key];
            if (currentBCriteriaIds.has(criterionId)) {
                scoreB += score;
                partBBreakdown[criterionId] = score;
            } else if (currentCCriteriaIds.has(criterionId)) {
                scoreC += score;
                partCBreakdown[criterionId] = score;
            }
        }
    }

    return (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-baseline font-bold text-lg">
                <span className="text-text-light dark:text-text-dark">{detail.judgeName}</span>
                <span className="text-text-light dark:text-text-dark">{detail.score?.toFixed(2) || 'N/A'}</span>
            </div>

            {scoreB !== null && scoreC !== null && (
                <div className="text-right text-xs text-text-muted-light dark:text-text-muted-dark -mt-2 mb-2 pr-1">
                    Part B: <strong>{scoreB.toFixed(2)}</strong>, Part C: <strong>{scoreC.toFixed(2)}</strong>
                </div>
            )}

            {detail.assignedSection === 'Part B & C' ? (
                <div className="space-y-3 mt-2">
                    {Object.keys(partBBreakdown).length > 0 && (
                        <div>
                            <h5 className="font-semibold text-sm text-secondary dark:text-accent-green">Part B: Oral Communication</h5>
                            <ScoreBreakdownTable breakdown={partBBreakdown} />
                        </div>
                    )}
                    {Object.keys(partCBreakdown).length > 0 && (
                        <div>
                            <h5 className="font-semibold text-sm text-secondary dark:text-accent-green">Part C: Scientific Thought</h5>
                            <ScoreBreakdownTable breakdown={partCBreakdown} />
                        </div>
                    )}
                </div>
            ) : (
                detail.scoreBreakdown && <ScoreBreakdownTable breakdown={detail.scoreBreakdown} />
            )}

            <div className="mt-3">
                <h5 className="font-semibold text-sm">Comments:</h5>
                <p className="text-sm mt-1 italic bg-white dark:bg-gray-700/50 p-2 rounded-md">"{detail.comments || 'No comment.'}"</p>
            </div>
            <div className="mt-2">
                <h5 className="font-semibold text-sm">Recommendations:</h5>
                <p className="text-sm mt-1 italic bg-white dark:bg-gray-700/50 p-2 rounded-md">"{detail.recommendations || 'No recommendation.'}"</p>
            </div>
        </div>
    );
};


const ProjectDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
}> = ({ isOpen, onClose, project }) => {
    const { calculateProjectScores, getProjectJudgingDetails, getCategoryStats } = useContext(AppContext);

    const [activeScores, setActiveScores] = useState<ProjectScores | null>(null);
    const [activeDetails, setActiveDetails] = useState<JudgingDetails[]>([]);
    const [previousLevel, setPreviousLevel] = useState<CompetitionLevel | null>(null);
    const [previousLevelScores, setPreviousLevelScores] = useState<ProjectScores | null>(null);
    const [previousLevelDetails, setPreviousLevelDetails] = useState<JudgingDetails[]>([]);
    const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);

    useEffect(() => {
        if (isOpen && project) {
            const currentLevel = project.currentLevel;
            setActiveScores(calculateProjectScores(project.id, currentLevel));
            setActiveDetails(getProjectJudgingDetails(project.id, currentLevel));
            setCategoryStats(getCategoryStats(project.category, currentLevel));

            const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
            const currentIdx = levelOrder.indexOf(currentLevel);
            const prevLevel = currentIdx > 0 ? levelOrder[currentIdx - 1] : null;

            setPreviousLevel(prevLevel);
            if (prevLevel) {
                setPreviousLevelScores(calculateProjectScores(project.id, prevLevel));
                setPreviousLevelDetails(getProjectJudgingDetails(project.id, prevLevel));
            } else {
                setPreviousLevelScores(null);
                setPreviousLevelDetails([]);
            }
        }
    }, [isOpen, project, calculateProjectScores, getProjectJudgingDetails, getCategoryStats]);


    const generateScoresheetForLevel = (doc: jsPDF, scoresToUse: ProjectScores | null, detailsToUse: JudgingDetails[], levelName: string) => {
        if (!scoresToUse || !project) return;

        let finalY = 28;
        doc.setFontSize(18);
        doc.text(`KSEF Scoresheet: ${project.title}`, 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Category: ${project.category} | School: ${project.school} | Level: ${levelName}`, 105, finalY, { align: 'center' });
        finalY += 12;

        (doc as any).autoTable({
            startY: finalY,
            head: [['Section', 'Max Score', 'Final Score']],
            body: [
                ['Part A (Written)', '30', scoresToUse.scoreA?.toFixed(2) || 'N/A'],
                ['Part B & C (Oral)', '50', scoresToUse.scoreBC?.toFixed(2) || 'N/A'],
                [{ content: 'Total Score', styles: { fontStyle: 'bold' } }, { content: '80', styles: { fontStyle: 'bold' } }, { content: scoresToUse.totalScore.toFixed(2), styles: { fontStyle: 'bold' } }]
            ],
            theme: 'grid',
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(14);
        doc.text("Judges' Detailed Feedback", 14, finalY);
        finalY += 5;

        detailsToUse.forEach(detail => {
            if (finalY > 250) { doc.addPage(); finalY = 20; }
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Feedback from: ${detail.judgeName} (${detail.assignedSection})`, 14, finalY);
            doc.setFont(undefined, 'normal');
            finalY += 6;

            let scoreB: number | null = null;
            let scoreC: number | null = null;

            if (detail.assignedSection === 'Part B & C' && detail.scoreBreakdown) {
                const isRobotics = project.category === 'Robotics';
                const currentBCriteriaIds = isRobotics ? roboticsBCriteriaIds : bCriteriaIds;
                const currentCCriteriaIds = isRobotics ? roboticsCCriteriaIds : cCriteriaIds;

                scoreB = 0;
                scoreC = 0;

                for (const key in detail.scoreBreakdown) {
                    const criterionId = parseInt(key);
                    const score = detail.scoreBreakdown[key];
                    if (currentBCriteriaIds.has(criterionId)) {
                        scoreB += score;
                    } else if (currentCCriteriaIds.has(criterionId)) {
                        scoreC += score;
                    }
                }
            }

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`Total Score:`, 14, finalY);
            doc.setFont(undefined, 'normal');
            doc.text(`${detail.score?.toFixed(2) || 'N/A'}`, 50, finalY);
            finalY += 6;

            if (scoreB !== null && scoreC !== null) {
                doc.setFont(undefined, 'italic');
                doc.text(`(Part B: ${scoreB.toFixed(2)}, Part C: ${scoreC.toFixed(2)})`, 50, finalY);
                doc.setFont(undefined, 'normal');
                finalY += 6;
            }

            if (detail.scoreBreakdown) {
                if (detail.assignedSection === 'Part B & C') {
                    const isRobotics = project.category === 'Robotics';
                    const currentBCriteriaIds = isRobotics ? roboticsBCriteriaIds : bCriteriaIds;
                    const currentCCriteriaIds = isRobotics ? roboticsCCriteriaIds : cCriteriaIds;

                    const partBBody = Object.entries(detail.scoreBreakdown).filter(([id]) => currentBCriteriaIds.has(Number(id))).map(([id, score]) => {
                        const criterion = criteriaMap.get(Number(id));
                        return [{ content: criterion?.text || `Criterion ${id}` }, { content: `${score} / ${criterion?.maxScore}` }];
                    });

                    const partCBody = Object.entries(detail.scoreBreakdown).filter(([id]) => currentCCriteriaIds.has(Number(id))).map(([id, score]) => {
                        const criterion = criteriaMap.get(Number(id));
                        return [{ content: criterion?.text || `Criterion ${id}` }, { content: `${score} / ${criterion?.maxScore}` }];
                    });

                    if (partBBody.length > 0) {
                        doc.setFontSize(10);
                        doc.setFont(undefined, 'bold');
                        doc.text(`Part B: Oral Communication Breakdown`, 14, finalY);
                        finalY += 4;
                        (doc as any).autoTable({ startY: finalY, head: [['Criterion', 'Score']], body: partBBody, theme: 'grid', headStyles: { fillColor: [240, 240, 240], textColor: 40 }, columnStyles: { 1: { halign: 'center' } } });
                        finalY = (doc as any).lastAutoTable.finalY + 5;
                    }
                    if (partCBody.length > 0) {
                        if (finalY > 250) { doc.addPage(); finalY = 20; }
                        doc.setFontSize(10);
                        doc.setFont(undefined, 'bold');
                        doc.text(`Part C: Scientific Thought Breakdown`, 14, finalY);
                        finalY += 4;
                        (doc as any).autoTable({ startY: finalY, head: [['Criterion', 'Score']], body: partCBody, theme: 'grid', headStyles: { fillColor: [240, 240, 240], textColor: 40 }, columnStyles: { 1: { halign: 'center' } } });
                        finalY = (doc as any).lastAutoTable.finalY + 5;
                    }

                } else { // Part A
                    const breakdownBody = Object.entries(detail.scoreBreakdown).map(([id, score]) => {
                        const criterion = criteriaMap.get(Number(id));
                        return [{ content: criterion?.text || `Criterion ${id}` }, { content: `${score} / ${criterion?.maxScore}` }];
                    });
                    (doc as any).autoTable({ startY: finalY, head: [['Criterion', 'Score']], body: breakdownBody, theme: 'grid', headStyles: { fillColor: [240, 240, 240], textColor: 40 }, columnStyles: { 1: { halign: 'center' } } });
                    finalY = (doc as any).lastAutoTable.finalY + 5;
                }
            }

            if (finalY > 250) { doc.addPage(); finalY = 20; }
            doc.setFont(undefined, 'bold');
            doc.text(`Comments:`, 14, finalY);
            doc.setFont(undefined, 'normal');
            const splitComments = doc.splitTextToSize(detail.comments || 'No comment provided.', 180);
            doc.text(splitComments, 14, finalY + 4);
            finalY += (splitComments.length * 4) + 5;

            if (finalY > 250) { doc.addPage(); finalY = 20; }

            doc.setFont(undefined, 'bold');
            doc.text(`Recommendations:`, 14, finalY);
            doc.setFont(undefined, 'normal');
            const splitRecommendations = doc.splitTextToSize(detail.recommendations || 'No recommendation provided.', 180);
            doc.text(splitRecommendations, 14, finalY + 4);
            finalY += (splitRecommendations.length * 4) + 10;
        });
    };

    const handleDownloadFullHistory = () => {
        if (!project) return;

        const doc = new jsPDF();
        let pagesGenerated = 0;

        if (activeScores && activeScores.isFullyJudged) {
            if (pagesGenerated > 0) doc.addPage();
            generateScoresheetForLevel(doc, activeScores, activeDetails, project.currentLevel);
            pagesGenerated++;
        }

        if (previousLevelScores && previousLevelScores.isFullyJudged) {
            if (pagesGenerated > 0) doc.addPage();
            generateScoresheetForLevel(doc, previousLevelScores, previousLevelDetails, previousLevel!);
            pagesGenerated++;
        }

        if (pagesGenerated > 0) {
            doc.save(`${project.title}_Competition_History.pdf`);
        }
    };

    const CategoryPerformanceChart: React.FC<{ scores: ProjectScores }> = ({ scores }) => {
        if (!categoryStats) return null;
        const data = [
            { name: project.category, 'Your Score': scores.totalScore, 'Category Average': categoryStats.average },
        ];
        return (
            <ResponsiveContainer width="100%" height={100}>
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" domain={[Math.floor(categoryStats.min / 10) * 10, Math.ceil(categoryStats.max / 10) * 10]} hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: '#00A8E8', color: '#E2E8F0' }} />
                    <Bar dataKey="Your Score" fill="#00A8E8" barSize={20} />
                    <ReferenceLine x={categoryStats.average} stroke="#FFBB28" strokeDasharray="3 3" />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    const ResultsDisplay: React.FC<{ scores: ProjectScores | null; details: JudgingDetails[]; levelName: string; project: Project; }> = ({ scores, details, levelName, project }) => {
        if (!scores || !scores.isFullyJudged) {
            return <p className="text-text-muted-light dark:text-text-muted-dark text-center py-4">Results for this level are not yet available.</p>;
        }

        const partADetails = details.filter(d => d.assignedSection === 'Part A');
        const partBCDetails = details.filter(d => d.assignedSection === 'Part B & C');

        return (
            <div className="space-y-4">
                <Card>
                    <h4 className="font-semibold mb-2">Final Score</h4>
                    <div className="font-bold text-3xl text-right text-primary">{scores.totalScore.toFixed(2)} / 80</div>
                </Card>

                {categoryStats && (
                    <Card>
                        <h4 className="font-semibold mb-2">Performance in Category ({categoryStats.count} projects)</h4>
                        <CategoryPerformanceChart scores={scores} />
                        <div className="flex justify-between text-xs text-text-muted-light dark:text-text-muted-dark px-2">
                            <span>Lowest: {categoryStats.min.toFixed(2)}</span>
                            <span className="font-bold text-yellow-500">Avg: {categoryStats.average.toFixed(2)}</span>
                            <span>Highest: {categoryStats.max.toFixed(2)}</span>
                        </div>
                    </Card>
                )}

                <Card>
                    <h4 className="font-semibold mb-2">Judges' Feedback</h4>
                    <div className="space-y-6">
                        <div>
                            <h5 className="font-bold text-lg text-secondary dark:text-accent-green mb-3 border-b-2 border-secondary/20 pb-1">Part A: Written Communication</h5>
                            <div className="space-y-4">
                                {partADetails.length > 0 ? (
                                    partADetails.map((detail, index) => (
                                        <JudgeFeedbackCard key={`A-${index}`} detail={detail} project={project} />
                                    ))
                                ) : (
                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">No feedback available for this section.</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <h5 className="font-bold text-lg text-secondary dark:text-accent-green mb-3 border-b-2 border-secondary/20 pb-1">Part B & C: Oral & Scientific Thought</h5>
                            <div className="space-y-4">
                                {partBCDetails.length > 0 ? (
                                    partBCDetails.map((detail, index) => (
                                        <JudgeFeedbackCard key={`BC-${index}`} detail={detail} project={project} />
                                    ))
                                ) : (
                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">No feedback available for this section.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    };

    if (!isOpen || !project) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-secondary dark:text-accent-green mb-2">Competition History: {project.title}</h3>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">{project.category} | {project.school}</p>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    <AccordionItem title={`Current Level: ${project.currentLevel}`} startOpen={true}>
                        <ResultsDisplay scores={activeScores} details={activeDetails} levelName={project.currentLevel} project={project} />
                    </AccordionItem>
                    {previousLevel && (
                        <AccordionItem title={`Previous Level: ${previousLevel}`}>
                            <ResultsDisplay scores={previousLevelScores} details={previousLevelDetails} levelName={previousLevel} project={project} />
                        </AccordionItem>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    <Button
                        onClick={handleDownloadFullHistory}
                        disabled={!activeScores?.isFullyJudged && !previousLevelScores?.isFullyJudged}
                        title={!activeScores?.isFullyJudged && !previousLevelScores?.isFullyJudged ? "No completed reports available to download" : "Download full competition history"}
                        className="flex items-center gap-2"
                    >
                        <Download /> Download Report
                    </Button>
                </div>
            </div>
        </div>
    );
};

const getLevelQualifiedFrom = (levelQualifiedTo: CompetitionLevel): CompetitionLevel | null => {
    const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
    const currentIndex = levelOrder.indexOf(levelQualifiedTo);
    if (currentIndex > 0) {
        return levelOrder[currentIndex - 1];
    }
    return null;
}


const PatronDashboard: React.FC = () => {
    const { user, projects, assignments, deleteProject, submissionDeadline, calculateProjectScores, calculateRankingsAndPoints, getProjectJudgingProgress, isLoading, isHistoricalView, isJudgingStarted, activeEdition, isEditionCompleted, showNotification } = useContext(AppContext);

    const navigate = useNavigate();

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [viewingProject, setViewingProject] = useState<Project | null>(null);

    const [confirmModalState, setConfirmModalState] = useState<{
        isOpen: boolean;
        projectToDelete: Project | null;
    }>({ isOpen: false, projectToDelete: null });

    const [activeFilter, setActiveFilter] = useState<'ALL' | 'QUALIFIED' | 'ACTIVE' | 'ELIMINATED'>('ALL');
    const [certificateMenu, setCertificateMenu] = useState<{ anchorEl: null | HTMLElement, project: Project | null }>({ anchorEl: null, project: null });

    const isDeadlinePassed = useMemo(() => submissionDeadline && new Date() > new Date(submissionDeadline), [submissionDeadline]);

    const schoolProjects = useMemo(() => {
        if (!user || !projects) return [];
        return projects.filter(p => p.patronId === user.id);
    }, [projects, user]);

    const rankingData = useMemo(() => {
        if (!calculateRankingsAndPoints) return { projectsWithPoints: [], schoolRanking: [], zoneRanking: {}, subCountyRanking: {}, countyRanking: {}, regionRanking: [] };
        return calculateRankingsAndPoints();
    }, [calculateRankingsAndPoints]);

    const projectStats = useMemo(() => {
        const active = schoolProjects.filter(p => !p.isEliminated && p.currentLevel === CompetitionLevel.SUB_COUNTY).length;
        const qualified = schoolProjects.filter(p => !p.isEliminated && p.currentLevel !== CompetitionLevel.SUB_COUNTY).length;
        const eliminated = schoolProjects.filter(p => p.isEliminated).length;
        return { total: schoolProjects.length, active, qualified, eliminated };
    }, [schoolProjects]);

    const filteredProjects = useMemo(() => {
        switch (activeFilter) {
            case 'ACTIVE':
                return schoolProjects.filter(p => !p.isEliminated && p.currentLevel === CompetitionLevel.SUB_COUNTY);
            case 'QUALIFIED':
                return schoolProjects.filter(p => !p.isEliminated && p.currentLevel !== CompetitionLevel.SUB_COUNTY);
            case 'ELIMINATED':
                return schoolProjects.filter(p => p.isEliminated);
            case 'ALL':
            default:
                return schoolProjects;
        }
    }, [schoolProjects, activeFilter]);

    const recentlyPromotedProjects = useMemo(() => {

        return schoolProjects.filter(p => !p.isEliminated && p.currentLevel !== CompetitionLevel.SUB_COUNTY && p.currentLevel !== CompetitionLevel.NATIONAL);
    }, [schoolProjects]);

    const { nationalWinners, nationalParticipants } = useMemo(() => {
        if (!isJudgingStarted) return { nationalWinners: [], nationalParticipants: [] };

        const nationalProjects = schoolProjects.filter(p => p.currentLevel === CompetitionLevel.NATIONAL);
        if (nationalProjects.length === 0) {
            return { nationalWinners: [], nationalParticipants: [] };
        }

        const nationalResultsPublished = projects.some(p => p.currentLevel === CompetitionLevel.NATIONAL && p.isEliminated);

        if (!nationalResultsPublished) {
            return { nationalWinners: [], nationalParticipants: [] };
        }

        const winners = nationalProjects.filter(p => !p.isEliminated);
        const participants = nationalProjects.filter(p => p.isEliminated);

        return { nationalWinners: winners, nationalParticipants: participants };
    }, [schoolProjects, projects, isJudgingStarted]);

    const schoolRank = useMemo(() => {
        if (!user?.school || !rankingData) return 'N/A';
        const rankInfo = rankingData.schoolRanking.find(s => s.name === user.school);
        if (!rankInfo) return 'N/A';
        return `#${rankInfo.rank}`;
    }, [rankingData, user]);

    const handleViewDetails = (project: Project) => {
        setViewingProject(project);
        setIsDetailsModalOpen(true);
    };

    const handleDeleteClick = (project: Project) => {
        setConfirmModalState({ isOpen: true, projectToDelete: project });
    };

    const handleConfirmDelete = () => {
        if (confirmModalState.projectToDelete) {
            deleteProject(confirmModalState.projectToDelete.id);
        }
        setConfirmModalState({ isOpen: false, projectToDelete: null });
    };

    const handleDownloadSchoolReport = () => {
        if (!user || !user.school || !rankingData) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`KSEF Performance Report for ${user.school}`, 105, 20, { align: 'center' });

        const schoolRankInfo = rankingData.schoolRanking.find(s => s.name === user.school);
        doc.setFontSize(12);
        doc.text(`Overall School Rank: ${schoolRankInfo ? '#' + schoolRankInfo.rank : 'N/A'} with ${schoolRankInfo ? schoolRankInfo.totalPoints.toFixed(0) : '0'} points.`, 14, 35);

        const projectsWithRanks = rankingData.projectsWithPoints.filter(p => p.school === user.school);

        if (projectsWithRanks.length > 0) {
            (doc as any).autoTable({
                startY: 45,
                head: [['Project Title', 'Category', 'Category Rank', 'Score', 'Points Earned']],
                body: projectsWithRanks.map(p => [p.title, p.category, p.categoryRank, p.totalScore.toFixed(2), p.points]),
                theme: 'grid',
                headStyles: { fillColor: [0, 52, 89] },
            });
        } else {
            doc.text("No fully judged projects were found for this school.", 14, 45);
        }

        doc.save(`${user.school}_Performance_Report.pdf`);
    };

    const handleCertificateMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, project: Project) => {
        setCertificateMenu({ anchorEl: event.currentTarget, project });
    };

    const handleCertificateMenuClose = () => {
        setCertificateMenu({ anchorEl: null, project: null });
    };

    const handleGenerateCertificate = async (type: 'Student' | 'Patron' | 'School', studentIndex?: number) => {
        const project = certificateMenu.project;
        if (!project || !user || !activeEdition) return;

        let levelFrom: CompetitionLevel | null;
        if (project.currentLevel === CompetitionLevel.NATIONAL && isEditionCompleted) {
            levelFrom = CompetitionLevel.NATIONAL;
        } else {
            levelFrom = getLevelQualifiedFrom(project.currentLevel);
        }
        const certificateLevel: CompetitionLevel | null = (type === 'School') ? project.currentLevel : levelFrom;
        if (!certificateLevel) {
            console.error("Could not determine level qualified from.");
            return;
        }

        let certName = '';
        let fileName = '';
        let tscNumber: string | undefined;
        let idNumber: string | undefined;

        switch (type) {
            case 'Student':
                certName = project.students[studentIndex!];
                fileName = `${project.title}_Cert_Student_${studentIndex! + 1}.pdf`;
                break;
            case 'Patron':
                certName = user.name;
                fileName = `${project.title}_Cert_Patron.pdf`;
                tscNumber = user.tscNumber;
                idNumber = user.idNumber;
                break;
            case 'School':
                certName = project.school;
                fileName = `${project.title}_Cert_School.pdf`;
                break;
        }

        // Determine national winner/participant status after publishing
        let isWinner = false;
        let isParticipant = false;
        let award: string | undefined;
        if (project.currentLevel === CompetitionLevel.NATIONAL && isEditionCompleted) {
            const ranked = rankingData?.projectsWithPoints?.find(p => p.id === project.id);
            if (ranked) {
                if (ranked.categoryRank && ranked.categoryRank <= 3) {
                    isWinner = true;
                    award = `Position ${ranked.categoryRank}`;
                } else {
                    isParticipant = true;
                }
            } else {
                // Fallback: treat as participant if ranking not found
                isParticipant = true;
            }
        }

        // If School certificate, ensure this level is published and aggregate all projects for the school at this level
        if (type === 'School') {
            const isLevelPublished = certificateLevel === CompetitionLevel.NATIONAL
                ? (isEditionCompleted || assignments.some(a => a.competitionLevel === CompetitionLevel.NATIONAL && a.isArchived))
                : assignments.some(a => a.competitionLevel === certificateLevel && a.isArchived);
            if (!isLevelPublished) {
                showNotification?.('Certificates will be available after publishing results for this level.', 'warning');
                return;
            }
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // For School: aggregate all school projects published at this level
        const schoolProjectsAtLevel = (type === 'School')
            ? projects
                .filter(p => p.school === project.school)
                .filter(p => assignments.some(a => a.projectId === p.id && a.competitionLevel === certificateLevel && a.isArchived))
                .map(p => p.title)
                .sort()
            : undefined;

        // Override naming for School to be per school/level
        if (type === 'School') {
            certName = project.school;
            fileName = `${project.school.replace(/\s+/g, '_')}_${certificateLevel}_School_Certificate.pdf`;
        }

        await addCertificatePage({
            doc,
            name: certName,
            type: type,
            projectTitle: project.title,
            school: project.school,
            levelFrom: certificateLevel,
            levelTo: project.currentLevel,
            editionName: activeEdition.name,
            region: project.region,
            county: project.county,
            subCounty: project.subCounty,
            tscNumber,
            idNumber,
            category: project.category,
            isWinner,
            isParticipant,
            award,
            projectsList: schoolProjectsAtLevel,
        });

        doc.save(fileName);
        handleCertificateMenuClose();
    };

    const renderStatus = (project: Project) => {
        if (project.status === ProjectStatus.REJECTED) {
            return <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold text-xs py-1 px-2 rounded-full bg-red-100 dark:bg-red-900/30"><AlertTriangle className="w-4 h-4" /> Rejected</span>;
        }
        if (project.status === ProjectStatus.AWAITING_APPROVAL) {
            return <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs py-1 px-2 rounded-full bg-amber-100 dark:bg-amber-900/30"><Clock className="w-4 h-4" /> Awaiting Verification</span>;
        }
        if (project.isEliminated) {
            return <span className="flex items-center gap-1.5 text-red-500 font-semibold text-xs py-1 px-2 rounded-full bg-red-100 dark:bg-red-900/30"><FilterX className="w-4 h-4" /> Eliminated at {project.currentLevel}</span>;
        }
        if (project.currentLevel === CompetitionLevel.NATIONAL) {
            if (isEditionCompleted) {
                return <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold text-xs py-1 px-2 rounded-full bg-green-100 dark:bg-green-900/30"><Trophy className="w-4 h-4" /> National competition completed</span>;
            }
            return <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold text-xs py-1 px-2 rounded-full bg-green-100 dark:bg-green-900/30"><Trophy className="w-4 h-4" /> Qualified for National Level</span>;
        }
        if (project.currentLevel !== CompetitionLevel.SUB_COUNTY) {
            return <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold text-xs py-1 px-2 rounded-full bg-green-100 dark:bg-green-900/30"><Trophy className="w-4 h-4" /> Qualified for {project.currentLevel} Level</span>;
        }
        return <span className="flex items-center gap-1.5 text-blue-500 font-semibold text-xs py-1 px-2 rounded-full bg-blue-100 dark:bg-blue-900/30"><Hourglass className="w-4 h-4" /> Active at {project.currentLevel}</span>;
    };

    const getCardClass = (filter: string) => {
        const base = 'cursor-pointer transition-all duration-300';
        const active = 'ring-2 ring-primary shadow-lg';
        const inactive = 'hover:ring-2 hover:ring-primary/50 hover:shadow-md';
        return `${base} ${activeFilter === filter ? active : inactive}`;
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
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Patron Dashboard</h2>
                <Button
                    onClick={() => navigate('/project/new')}
                    className="flex items-center gap-2"
                    disabled={isDeadlinePassed || isHistoricalView || isJudgingStarted}
                    title={
                        isHistoricalView ? "Cannot add projects in historical view"
                            : isDeadlinePassed ? 'The submission deadline has passed'
                                : isJudgingStarted ? 'Project registration is locked because judging has started.'
                                    : 'Add a new project'
                    }
                >
                    <Plus className="w-5 h-5" /> Add New Project
                </Button>
            </div>

            {recentlyPromotedProjects.length > 0 && !isHistoricalView && (
                <Card className="bg-green-100 dark:bg-green-900/40 border border-green-400">
                    <div className="flex items-start gap-4">
                        <Trophy className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
                        <div>
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">Congratulations!</h3>
                            <p className="text-green-700 dark:text-green-400">The following project(s) have qualified for the next level of the competition:</p>
                            <ul className="list-disc list-inside mt-2 text-green-700 dark:text-green-400 font-medium">
                                {recentlyPromotedProjects.map(p => (
                                    <li key={p.id}>"{p.title}" has advanced to the {p.currentLevel} level.</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Card>
            )}

            {nationalWinners.length > 0 && !isHistoricalView && (
                <Card className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400">
                    <div className="flex items-start gap-4">
                        <Award className="w-8 h-8 text-yellow-500 flex-shrink-0 mt-1" />
                        <div>
                            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">National Fair Winners!</h3>
                            <p className="text-yellow-700 dark:text-yellow-400">
                                Huge congratulations! The following project(s) have achieved a top-4 position in their category at the National level:
                            </p>
                            <ul className="list-disc list-inside mt-2 text-yellow-700 dark:text-yellow-400 font-medium">
                                {nationalWinners.map(p => (
                                    <li key={p.id}>"{p.title}"</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Card>
            )}

            {nationalParticipants.length > 0 && !isHistoricalView && (
                <Card className="bg-blue-100 dark:bg-blue-900/40 border border-blue-400">
                    <div className="flex items-start gap-4">
                        <Trophy className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
                        <div>
                            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">National Fair Participation</h3>
                            <p className="text-blue-700 dark:text-blue-400">
                                Congratulations on reaching the final stage! The following project(s) represented your school with distinction at the National level:
                            </p>
                            <ul className="list-disc list-inside mt-2 text-blue-700 dark:text-blue-400 font-medium">
                                {nationalParticipants.map(p => (
                                    <li key={p.id}>"{p.title}"</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <DashboardCard title="Overall School Rank" value={schoolRank} icon={<Award />} />
                <DashboardCard title="Total School Projects" value={projectStats.total.toString()} icon={<BarChart2 />} onClick={() => setActiveFilter('ALL')} className={getCardClass('ALL')} />
                <DashboardCard title="Projects Qualified" value={projectStats.qualified.toString()} icon={<Trophy />} onClick={() => setActiveFilter('QUALIFIED')} className={getCardClass('QUALIFIED')} />
                <DashboardCard title="Active Projects" value={projectStats.active.toString()} icon={<Clock />} onClick={() => setActiveFilter('ACTIVE')} className={getCardClass('ACTIVE')} />
                <DashboardCard title="Eliminated" value={projectStats.eliminated.toString()} icon={<FilterX />} onClick={() => setActiveFilter('ELIMINATED')} className={getCardClass('ELIMINATED')} />
            </div>

            <Card>
                <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
                    My Projects ({activeFilter})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-text-muted-light dark:text-text-muted-dark">Project Title</th>
                                <th className="px-4 py-3 text-text-muted-light dark:text-text-muted-dark">Category</th>
                                <th className="px-4 py-3 w-48 text-text-muted-light dark:text-text-muted-dark">Judging Progress</th>
                                <th className="px-4 py-3 text-text-muted-light dark:text-text-muted-dark">Competition Status</th>
                                <th className="px-4 py-3 text-center text-text-muted-light dark:text-text-muted-dark">Certificates</th>
                                <th className="px-4 py-3 text-center text-text-muted-light dark:text-text-muted-dark">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.map(project => {
                                const projectAssignments = assignments.filter(a => a.projectId === project.id);
                                const hasJudgingStarted = projectAssignments.some(a => a.status !== ProjectStatus.NOT_STARTED);
                                // Allow editing if rejected, even if judging appeared to have started (e.g. spurious assignments), but respect deadline.
                                const isLocked = (hasJudgingStarted && project.status !== ProjectStatus.REJECTED) || isDeadlinePassed || isHistoricalView;
                                const hasQualified = !project.isEliminated && project.currentLevel !== CompetitionLevel.SUB_COUNTY;
                                const canDownloadCert = hasQualified || (project.currentLevel === CompetitionLevel.NATIONAL && isEditionCompleted);

                                const { percentage: completionPercentage } = getProjectJudgingProgress(project.id, project.currentLevel);

                                const scores = calculateProjectScores(project.id, project.currentLevel);

                                return (
                                    <tr key={project.id} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-3 font-medium text-text-light dark:text-text-dark">{project.title}</td>
                                        <td className="px-4 py-3 text-text-light dark:text-text-dark">{project.category}</td>
                                        <td className="px-4 py-3 text-text-light dark:text-text-dark">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                    <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${completionPercentage}%` }}></div>
                                                </div>
                                                <span className="text-xs font-semibold w-10 text-right">{completionPercentage.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {renderStatus(project)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {canDownloadCert && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => handleCertificateMenuOpen(e, project)}
                                                    className="flex items-center gap-1"
                                                >
                                                    <CertificateIcon className="w-4 h-4" /> Download
                                                </Button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 flex items-center justify-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleViewDetails(project)}
                                                disabled={!scores.isFullyJudged && !assignments.some(a => a.projectId === project.id && a.isArchived)}
                                                title={(scores.isFullyJudged || assignments.some(a => a.projectId === project.id && a.isArchived)) ? "View scores and feedback history" : "Results are not yet available for viewing"}
                                                className="flex items-center gap-1"
                                            >
                                                <Eye className="w-4 h-4" /> View
                                            </Button>
                                            <Button variant="ghost" className="p-2" onClick={() => navigate(`/project/edit/${project.id}`)} aria-label="Edit" title={isLocked ? "Cannot edit project: The submission deadline has passed, judging has begun, or you are in historical view mode." : "Edit Project"} disabled={isLocked}>
                                                <Edit className={`w-4 h-4 ${isLocked ? 'text-gray-400 dark:text-gray-500' : 'text-blue-500'}`} />
                                            </Button>
                                            <Button variant="ghost" className="p-2" onClick={() => handleDeleteClick(project)} aria-label="Delete" title={isLocked ? "Cannot delete project: The submission deadline has passed, judging has begun, or you are in historical view mode." : "Delete Project"} disabled={isLocked}>
                                                <Trash2 className={`w-4 h-4 ${isLocked ? 'text-gray-400 dark:text-gray-500' : 'text-red-500'}`} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {certificateMenu.anchorEl && (
                        <div className="fixed z-10" style={{ top: certificateMenu.anchorEl.getBoundingClientRect().bottom + 8, left: certificateMenu.anchorEl.getBoundingClientRect().left }}>
                            <Card className="p-2 shadow-2xl">
                                <ul className="text-sm">
                                    {certificateMenu.project?.students.map((student, index) => (
                                        <li key={student} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer" onClick={() => handleGenerateCertificate('Student', index)}>For Student: {student}</li>
                                    ))}
                                    <li className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer" onClick={() => handleGenerateCertificate('Patron')}>For Patron: {user.name}</li>
                                    <li className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer" onClick={() => handleGenerateCertificate('School')}>For School: {certificateMenu.project?.school}</li>
                                </ul>
                            </Card>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">School Performance Report</h3>
                        <p className="text-text-muted-light dark:text-text-muted-dark mt-1">
                            Download a detailed PDF report of all your school's project performances and overall ranking.
                        </p>
                    </div>
                    <Button variant="secondary" onClick={handleDownloadSchoolReport} className="w-full sm:w-auto flex items-center justify-center gap-2">
                        <Download /> Download School Report
                    </Button>
                </div>
            </Card>

            {isDetailsModalOpen && <ProjectDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} project={viewingProject} />}
            {confirmModalState.isOpen && confirmModalState.projectToDelete && (
                <ConfirmationModal
                    isOpen={confirmModalState.isOpen}
                    onClose={() => setConfirmModalState({ isOpen: false, projectToDelete: null })}
                    onConfirm={handleConfirmDelete}
                    title="Delete Project"
                    confirmText="Delete"
                >
                    Are you sure you want to delete the project "{confirmModalState.projectToDelete.title}"? This action cannot be undone.
                </ConfirmationModal>
            )}
        </div>
    );
};

export default PatronDashboard;
