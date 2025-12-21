


import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from 'react';
// FIX: Replaced namespace import for react-router-dom with named imports to resolve module export errors.
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AppContext, JudgingTimerSettings } from '../context/AppContext';
// FIX: Removed `USERS` import as it is not exported from constants. The user list will be fetched from context.
import { SCORE_SHEET, ROBOTICS_SCORE_SHEET } from '../constants';
import { generateJudgingComments } from '../utils/aiService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { JudgingCriterion, ProjectStatus, JudgeAssignment, UserRole, JudgingSection } from '../types';
import { ArrowLeft, Check, Users, AlertCircle, AlertTriangle, Clock, Sparkles, Loader } from 'lucide-react';
import InfoModal from '../components/ui/InfoModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';


// Helper function to validate a score based on its criterion rules.
const validateScore = (score: string | number, max: number, step: number): number => {
    const numValue = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(numValue)) {
        return 0;
    }
    let validatedValue = Math.max(0, Math.min(numValue, max));
    // Handle floating point inaccuracies by rounding to the nearest step and fixing precision.
    validatedValue = parseFloat((Math.round(validatedValue / step) * step).toFixed(2));
    return validatedValue;
};

// Helper to generate score options for quick-select buttons
const generateScoreOptions = (max: number, step: number): number[] => {
    const options: number[] = [];
    // Use a small epsilon to handle floating point inaccuracies
    for (let i = 0; i <= max + 1e-9; i += step) {
        options.push(parseFloat(i.toFixed(2)));
    }
    return options;
};

// --- Sub-components for the new layout ---

const CriterionInput: React.FC<{
    criterion: JudgingCriterion;
    value: number | string;
    reviewScores?: { judgeName: string; score?: number }[];
    error?: string;
    onUpdate: (id: number, val: string) => void;
    onValidate: (id: number, val: string, max: number, step: number) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: number) => void;
}> = ({ criterion, value, reviewScores, error, onUpdate, onValidate, onKeyDown }) => {
    const { id, text, details, maxScore, step = 0.5 } = criterion;
    const scoreOptions = generateScoreOptions(maxScore, step);

    const handleQuickSelect = (scoreValue: number) => {
        // Update and immediately validate
        onUpdate(id, String(scoreValue));
        onValidate(id, String(scoreValue), maxScore, step);
    };

    return (
        <div className={`p-4 bg-background-light dark:bg-background-dark rounded-lg border ${error ? 'border-red-500 shadow-md' : 'dark:border-gray-700'} transition-all duration-300 hover:shadow-md`}>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                {/* Criterion Details */}
                <div className="flex-1">
                    <p className="font-semibold text-text-light dark:text-text-dark">{text}</p>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">{details}</p>
                    {reviewScores && reviewScores.length > 0 && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                            <p className="text-xs font-bold flex items-center gap-1"><Users className="w-3 h-3" /> Other Judges' Total Scores:</p>
                            <div className="flex gap-4 text-xs">
                                {reviewScores.map((rs, i) => (
                                    <p key={i}><strong>{rs.judgeName}:</strong> <span className="text-primary">{rs.score}</span></p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Scoring Controls */}
                <div className="flex flex-col items-start md:items-end gap-2" style={{ minWidth: '180px' }}>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            data-criterion-id={id}
                            onChange={(e) => onUpdate(id, e.target.value)}
                            onBlur={(e) => onValidate(id, e.target.value, maxScore, step)}
                            onKeyDown={(e) => onKeyDown(e, id)}
                            className={`w-20 p-2 text-center font-bold text-lg text-primary bg-white dark:bg-gray-800 border-2 rounded-md transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary'}`}
                        />
                        <span className="font-semibold text-lg text-text-muted-light dark:text-text-muted-dark">/ {maxScore}</span>
                    </div>
                    {scoreOptions.length <= 6 && ( // Only show quick select for a reasonable number of options
                        <div className="flex flex-wrap gap-1">
                            {scoreOptions.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleQuickSelect(opt)}
                                    className={`w-10 h-7 text-xs font-semibold rounded-md transition-colors ${Number(value) === opt && value !== ''
                                        ? 'bg-primary text-white ring-2 ring-primary-dark'
                                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// --- NEW --- Custom type for the robotics sheet
type RoboticsJudgingSection = JudgingSection & {
    isRoboticsMissions?: boolean;
    roboticsMissions?: {
        compulsory: { id: number, text: string, maxScore: number }[];
        studentGenerated: { id: number, text: string, maxScore: number }[];
    }
};

type Mission = { id: number, text: string, maxScore: number };

const MissionInput: React.FC<{
    mission: Mission;
    value: number | string;
    error?: string;
    onUpdate: (id: number, val: string) => void;
    onValidate: (id: number, val: string, max: number, step: number) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: number) => void;
    isStudentMission?: boolean;
    description?: string;
    onDescriptionChange?: (id: number, val: string) => void;
}> = ({ mission, value, error, onUpdate, onValidate, onKeyDown, isStudentMission, description, onDescriptionChange }) => {
    return (
        <div className={`p-4 bg-background-light dark:bg-background-dark rounded-lg border ${error ? 'border-red-500 shadow-md' : 'dark:border-gray-700'} transition-all duration-300 hover:shadow-md`}>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex-1">
                    {isStudentMission ? (
                        <textarea
                            value={description}
                            onChange={(e) => onDescriptionChange?.(mission.id, e.target.value)}
                            placeholder={`Describe Student Mission ${mission.id - 202}...`}
                            rows={2}
                            className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                        />
                    ) : (
                        <p className="font-semibold text-text-light dark:text-text-dark">{mission.text}</p>
                    )}
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">Score ranges: Successful (7-10), Partial (4-6), Attempted (1-3)</p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2" style={{ minWidth: '180px' }}>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            data-criterion-id={mission.id}
                            onChange={(e) => onUpdate(mission.id, e.target.value)}
                            onBlur={(e) => onValidate(mission.id, e.target.value, mission.maxScore, 1)}
                            onKeyDown={(e) => onKeyDown(e, mission.id)}
                            className={`w-20 p-2 text-center font-bold text-lg text-primary bg-white dark:bg-gray-800 border-2 rounded-md transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary'}`}
                        />
                        <span className="font-semibold text-lg text-text-muted-light dark:text-text-muted-dark">/ {mission.maxScore}</span>
                    </div>
                </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};

const RoboticsMissionsInput: React.FC<{
    missionData: RoboticsJudgingSection['roboticsMissions'];
    scores: { [key: number]: number | string };
    onUpdate: (id: number, val: string) => void;
    onValidate: (id: number, val: string, max: number, step: number) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: number) => void;
    errors: { [key: number]: string };
    studentMissionTexts: { [key: number]: string };
    onStudentMissionTextChange: (id: number, text: string) => void;
}> = ({ missionData, scores, onUpdate, onValidate, onKeyDown, errors, studentMissionTexts, onStudentMissionTextChange }) => {
    if (!missionData) return null;
    return (
        <div className="space-y-6">
            <div>
                <h4 className="font-semibold text-lg text-text-light dark:text-text-dark mb-2">(a.) COMPULSORY MISSIONS</h4>
                <div className="space-y-3">
                    {missionData.compulsory.map(mission => (
                        <MissionInput
                            key={mission.id}
                            mission={mission}
                            value={scores[mission.id] ?? ''}
                            error={errors[mission.id]}
                            onUpdate={onUpdate}
                            onValidate={onValidate}
                            onKeyDown={onKeyDown}
                        />
                    ))}
                </div>
            </div>
            <div>
                <h4 className="font-semibold text-lg text-text-light dark:text-text-dark mb-2">(b.) STUDENT GENERATED MISSIONS</h4>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-3">
                    A student must generate 3 original missions. Specification of a mission: (1) A robot must perform a task and return to the starting point. (2) The robot should be autonomous. (3) The missions should be original and unique.
                </p>
                <div className="space-y-3">
                    {missionData.studentGenerated.map(mission => (
                        <MissionInput
                            key={mission.id}
                            mission={mission}
                            value={scores[mission.id] ?? ''}
                            error={errors[mission.id]}
                            onUpdate={onUpdate}
                            onValidate={onValidate}
                            onKeyDown={onKeyDown}
                            isStudentMission={true}
                            description={studentMissionTexts[mission.id] || ''}
                            onDescriptionChange={onStudentMissionTextChange}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};


export const JudgingForm: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        user, projects, users, assignments, startJudging, updateAssignment, submitAssignmentScore,
        setActiveJudgingInfo, roboticsMissions, applicableTimerSettings, handleJudgeTimeout,
        showNotification, isWithinJudgingHours,
        // FIX: Add viewingEdition and viewingLevel from context.
        viewingEdition, viewingLevel, geminiApiKey
    } = useContext(AppContext);

    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const sectionParam = queryParams.get('section');
    const isReviewMode = queryParams.get('review') === 'true';

    const [scores, setScores] = useState<{ [key: number]: number | string }>({});
    const [studentMissionTexts, setStudentMissionTexts] = useState<{ [key: number]: string }>({});
    const [comments, setComments] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ [key: number]: string }>({});
    const [generalError, setGeneralError] = useState('');
    const [conflictError, setConflictError] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSessionExpired, setIsSessionExpired] = useState(false);

    // --- TIMER STATE ---
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [displayTime, setDisplayTime] = useState(0);
    const [showInactivityModal, setShowInactivityModal] = useState(false);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const firstCriterionCardRef = useRef<HTMLDivElement>(null);

    // --- NEW --- Flag to check if the user is a coordinator in review mode.
    const isCoordinatorReview = useMemo(() => isReviewMode && user?.currentRole === UserRole.COORDINATOR, [isReviewMode, user]);

    const resetInactivityTimer = useCallback((_event?: any) => {
        if (showInactivityModal) return;
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
            setShowInactivityModal(true);
        }, INACTIVITY_TIMEOUT_MS);
    }, [showInactivityModal]);

    useEffect(() => {
        window.addEventListener('mousemove', resetInactivityTimer);
        window.addEventListener('keydown', resetInactivityTimer);
        window.addEventListener('scroll', resetInactivityTimer);
        // FIX: Pass undefined to resetInactivityTimer to satisfy TypeScript's strict argument checking for functions used as event handlers.
        resetInactivityTimer(undefined);
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
            window.removeEventListener('mousemove', resetInactivityTimer);
            window.removeEventListener('keydown', resetInactivityTimer);
            window.removeEventListener('scroll', resetInactivityTimer);
        };
    }, [resetInactivityTimer]);

    const handleContinueJudging = () => {
        setShowInactivityModal(false);
        // FIX: Pass undefined to resetInactivityTimer to satisfy its function signature, resolving "Expected 1 arguments, but got 0" error.
        resetInactivityTimer(undefined);
    };

    const formatTime = (totalSeconds: number): string => {
        if (totalSeconds === Infinity) return 'N/A';
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const { project, assignment, sections, otherJudgeAssignments } = useMemo(() => {
        if (!projectId || !user) return { project: null, assignment: null, sections: [], otherJudgeAssignments: [] };

        const currentProject = projects.find(p => p.id === projectId);
        const isRobotics = currentProject?.category === 'Robotics';

        let currentAssignment = assignments.find(a => a.projectId === projectId && a.judgeId === user.id && a.assignedSection === sectionParam);

        // FIX: Add missing edition_id and competitionLevel to the temporary assignment object.
        if (!currentAssignment && isReviewMode && user.currentRole === UserRole.COORDINATOR && sectionParam && viewingEdition) {
            currentAssignment = {
                projectId: projectId,
                judgeId: user.id,
                assignedSection: sectionParam as 'Part A' | 'Part B & C',
                status: ProjectStatus.IN_PROGRESS,
                edition_id: viewingEdition.id,
                competitionLevel: viewingLevel,
            };
        }

        const baseScoreSheet = isRobotics ? JSON.parse(JSON.stringify(ROBOTICS_SCORE_SHEET)) : SCORE_SHEET;
        let currentSections: RoboticsJudgingSection[] = [];

        if (currentAssignment) {
            if (isRobotics) {
                const partC = baseScoreSheet.find((s: any) => s.id === 'C');
                if (partC && partC.roboticsMissions) {
                    partC.roboticsMissions.compulsory[0].text = roboticsMissions.mission1 || partC.roboticsMissions.compulsory[0].text;
                    partC.roboticsMissions.compulsory[1].text = roboticsMissions.mission2 || partC.roboticsMissions.compulsory[1].text;
                }

                if (currentAssignment.assignedSection === 'Part A') {
                    const sec = baseScoreSheet.find((s: any) => s.id === 'A');
                    if (sec) currentSections.push(sec);
                } else if (currentAssignment.assignedSection === 'Part B & C') {
                    const secB = baseScoreSheet.find((s: any) => s.id === 'B');
                    const secC = baseScoreSheet.find((s: any) => s.id === 'C');
                    if (secB) currentSections.push(secB as RoboticsJudgingSection);
                    if (secC) currentSections.push(secC as RoboticsJudgingSection);
                }
            } else {
                const secId = currentAssignment.assignedSection === 'Part A' ? 'A' : 'BC';
                const sec = baseScoreSheet.find((s: any) => s.id === secId);
                if (sec) currentSections.push(sec);
            }
        }

        let otherAssignments: JudgeAssignment[] = [];
        if (isReviewMode && currentProject && currentSections.length > 0) {
            otherAssignments = assignments.filter(a =>
                a.projectId === projectId &&
                a.assignedSection === currentAssignment?.assignedSection &&
                a.status === ProjectStatus.COMPLETED
            );
        }

        return { project: currentProject, assignment: currentAssignment, sections: currentSections, otherJudgeAssignments: otherAssignments };
    }, [projectId, user, projects, assignments, sectionParam, isReviewMode, roboticsMissions, viewingEdition, viewingLevel]);

    const allCriteriaAndMissions = useMemo(() => {
        return sections.flatMap(s => {
            if (s.isRoboticsMissions && s.roboticsMissions) {
                return [...s.roboticsMissions.compulsory, ...s.roboticsMissions.studentGenerated];
            }
            return s.criteria;
        });
    }, [sections]);

    const { minTime, maxTime } = useMemo(() => {
        if (!assignment) return { minTime: 0, maxTime: Infinity };
        const isPartA = assignment.assignedSection === 'Part A';
        return {
            minTime: (isPartA ? applicableTimerSettings.minTimeA : applicableTimerSettings.minTimeBC) * 60,
            maxTime: (isPartA ? applicableTimerSettings.maxTimeA : applicableTimerSettings.maxTimeBC) * 60,
        };
    }, [assignment, applicableTimerSettings]);

    const orderedCriteriaIds = useMemo(() => allCriteriaAndMissions.map(c => c.id), [allCriteriaAndMissions]);

    const sessionKey = useMemo(() => `judging-${projectId}-${user?.id}-${assignment?.assignedSection}`, [projectId, user?.id, assignment?.assignedSection]);
    const timerSessionKey = useMemo(() => `judging-timer-start-${projectId}-${user?.id}-${assignment?.assignedSection}`, [projectId, user?.id, assignment?.assignedSection]);

    // Check if judging hours expire during the session
    useEffect(() => {
        const checkJudgingHours = () => {
            if (!isWithinJudgingHours) {
                setIsSessionExpired(true);
                clearInterval(interval);
            }
        };
        const interval = setInterval(checkJudgingHours, 5000); // Check every 5 seconds
        return () => clearInterval(interval);
    }, [isWithinJudgingHours]);

    const handleFormInteraction = useCallback(() => {
        if (sessionStartTime === null) {
            const startTime = Date.now();
            setSessionStartTime(startTime);
            sessionStorage.setItem(timerSessionKey, String(startTime));
        }
    }, [sessionStartTime, timerSessionKey]);

    useEffect(() => {
        if (!sessionStartTime || !project || isTimedOut) return;

        const timer = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
            setDisplayTime(elapsedSeconds);

            if (elapsedSeconds > maxTime && maxTime !== Infinity) {
                if (!isTimedOut) {
                    setIsTimedOut(true);
                    showNotification(`Session timed out after ${maxTime / 60} minutes. This project has been sent for review.`, 'error', 10000);
                    handleJudgeTimeout(project.id, user!.id, assignment!.assignedSection, project.category);
                    navigate('/dashboard');
                }
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [sessionStartTime, maxTime, isTimedOut, project, user, assignment, handleJudgeTimeout, navigate, showNotification]);

    useEffect(() => {
        if (project && user && user.currentRole === UserRole.JUDGE && user.school && project.school && user.school === project.school) {
            setConflictError("You cannot judge this project due to a conflict of interest because it is from your own school. This assignment has been flagged for coordinator review.");
        } else {
            setConflictError(null);
        }
    }, [project, user]);

    useEffect(() => {
        if (conflictError) return;
        const savedStateJSON = sessionStorage.getItem(sessionKey);
        const savedStartTime = sessionStorage.getItem(timerSessionKey);

        if (savedStartTime) {
            setSessionStartTime(parseInt(savedStartTime, 10));
        }

        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            setScores(savedState.scores || {});
            setStudentMissionTexts(savedState.studentMissionTexts || {});
            setComments(savedState.comments || '');
            setRecommendations(savedState.recommendations || '');
        } else if (assignment) {
            setScores(assignment.scoreBreakdown || {});
            setStudentMissionTexts(assignment.missionDescriptions || {});
            setComments(assignment.comments || '');
            setRecommendations(assignment.recommendations || '');
        } else if (sections.length > 0) {
            const initialScores = allCriteriaAndMissions.reduce((acc, criterion) => {
                acc[criterion.id] = '';
                return acc;
            }, {} as { [key: number]: string });
            setScores(initialScores);
        }
    }, [sessionKey, timerSessionKey, sections, conflictError, allCriteriaAndMissions, assignment]);

    useEffect(() => {
        if (sections.length > 0 && !conflictError) {
            sessionStorage.setItem(sessionKey, JSON.stringify({ scores, studentMissionTexts, comments, recommendations }));
        }
    }, [scores, studentMissionTexts, comments, recommendations, sessionKey, sections, conflictError]);

    const statusUpdateRef = useRef<string | null>(null);
    useEffect(() => {
        if (conflictError) return;
        if (assignment && sections.length > 0 && statusUpdateRef.current !== assignment.projectId) {
            if (assignment.status === ProjectStatus.NOT_STARTED) {
                updateAssignment({ ...assignment, status: ProjectStatus.IN_PROGRESS });
            }
            startJudging(assignment.projectId, assignment.assignedSection).then(result => {
                if (result.success) {
                    // Scroll down after session is confirmed
                    setTimeout(() => {
                        firstCriterionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 500); // A small delay to ensure rendering and animations
                }
            });
            statusUpdateRef.current = assignment.projectId;
        }
    }, [assignment, sections, updateAssignment, startJudging, conflictError]);

    const handleScoreUpdate = (criterionId: number, stringValue: string) => {
        handleFormInteraction();
        setScores(prev => ({ ...prev, [criterionId]: stringValue }));
        setGeneralError('');
        if (errors[criterionId]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[criterionId];
                return newErrors;
            });
        }
    };

    const handleStudentMissionTextChange = (id: number, text: string) => {
        handleFormInteraction();
        setStudentMissionTexts(prev => ({ ...prev, [id]: text }));
    };

    const handleScoreValidation = (criterionId: number, stringValue: string, max: number, step: number) => {
        if (stringValue.trim() === '') {
            setScores(prev => ({ ...prev, [criterionId]: '' }));
            return;
        }
        const numValue = parseFloat(stringValue);
        if (isNaN(numValue)) {
            setScores(prev => ({ ...prev, [criterionId]: '' }));
            return;
        }

        let validatedValue = Math.max(0, Math.min(numValue, max));
        validatedValue = parseFloat((Math.round(validatedValue / step) * step).toFixed(2));
        setScores(prev => ({ ...prev, [criterionId]: validatedValue }));
    };

    const isBeforeMinTime = sessionStartTime !== null && displayTime < minTime;

    const isFormComplete = useMemo(() => {
        if (allCriteriaAndMissions.length === 0) return false;

        const allScoresEntered = allCriteriaAndMissions.every(
            (criterion) => {
                const score = scores[criterion.id];
                return score !== '' && score !== undefined && score !== null && !isNaN(parseFloat(String(score)));
            }
        );
        const commentsEntered = comments.trim() !== '';
        const recommendationsEntered = recommendations.trim() !== '';

        return allScoresEntered && commentsEntered && recommendationsEntered;
    }, [scores, comments, recommendations, allCriteriaAndMissions]);

    const scoredCriteriaCount = useMemo(() => {
        return Object.values(scores).filter(score => score !== '' && score !== null && score !== undefined).length;
    }, [scores]);

    const generateAiComments = async () => {
        if (allCriteriaAndMissions.length === 0) return;

        const scoredCriteria = allCriteriaAndMissions.filter(c => {
            const score = scores[c.id];
            return score !== '' && score !== null && score !== undefined && !isNaN(parseFloat(String(score)));
        });

        if (scoredCriteria.length === 0) {
            setGeneralError("Please enter some scores before generating AI feedback.");
            return;
        }

        setIsAiLoading(true);
        setGeneralError('');

        try {
            const promptIntro = `You are an assistant for a science fair judge. Generate constructive feedback based on the scores provided.
The scoring for each criterion is on a scale where higher scores are better.

Based on these scores, provide:
1.  A short, summarized paragraph for 'General Comments'. Highlight 1-2 key strengths and briefly mention areas for improvement. Maintain a positive tone.
2.  A bulleted list of specific, actionable suggestions for 'Recommendations'. Focus on criteria with lower scores.

Here are the scores:
`;
            const scoreDetails = scoredCriteria.map(c => `- Criterion: "${(c as any).text}" - Score: ${scores[c.id]} / ${c.maxScore}`).join('\n');
            const fullPrompt = promptIntro + scoreDetails;

            const feedback = await generateJudgingComments(fullPrompt, geminiApiKey);

            setComments(prev => prev ? prev + `\n\n--- AI Suggestions ---\n` + feedback.comments : feedback.comments);
            setRecommendations(prev => prev ? prev + `\n\n--- AI Suggestions ---\n` + feedback.recommendations : feedback.recommendations);

        } catch (e: any) {
            console.error("AI comment generation failed:", e);
            setGeneralError(`An error occurred while generating AI comments: ${e.message}`);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!assignment || allCriteriaAndMissions.length === 0) return;

        const newErrors: { [key: number]: string } = {};
        let finalTotalScore = 0;
        const scoreBreakdown: { [key: number]: number } = {};

        for (const criterion of allCriteriaAndMissions) {
            const scoreValue = scores[criterion.id];
            if (scoreValue === '' || scoreValue === null || scoreValue === undefined) {
                newErrors[criterion.id] = 'This field is required.';
                continue;
            }
            const numericScore = parseFloat(String(scoreValue));
            if (isNaN(numericScore)) {
                newErrors[criterion.id] = 'Please enter a valid number.';
                continue;
            }
            const step = (criterion as any).step || 1;
            const validatedScore = validateScore(numericScore, criterion.maxScore, step);
            finalTotalScore += validatedScore;
            scoreBreakdown[criterion.id] = validatedScore;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setGeneralError('Please fix the errors highlighted below before submitting.');
            const firstErrorId = Object.keys(newErrors)[0];
            document.querySelector(`input[data-criterion-id='${firstErrorId}']`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (comments.trim() === '' || recommendations.trim() === '') {
            setGeneralError('Please fill in the Comments and Recommendations sections.');
            return;
        }

        setErrors({});
        setGeneralError('');
        setIsSubmitting(true);

        const completedAssignment: JudgeAssignment = {
            ...assignment,
            status: ProjectStatus.COMPLETED,
            score: finalTotalScore,
            comments: comments,
            recommendations: recommendations,
            scoreBreakdown: scoreBreakdown,
            missionDescriptions: studentMissionTexts,
        };

        const success = await submitAssignmentScore(completedAssignment);

        if (success) {
            setActiveJudgingInfo(null);
            sessionStorage.removeItem(sessionKey);
            sessionStorage.removeItem('activeJudgingInfo');
            sessionStorage.removeItem(timerSessionKey);
            navigate('/dashboard');
        } else {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, currentCriterionId: number) => {
        const isTabForward = event.key === 'Tab' && !event.shiftKey;
        const isTabBackward = event.key === 'Tab' && event.shiftKey;

        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && !isTabForward && !isTabBackward) return;

        event.preventDefault();

        const currentIndex = orderedCriteriaIds.indexOf(currentCriterionId);
        let nextIndex;

        if (event.key === 'ArrowUp' || isTabBackward) {
            nextIndex = (currentIndex - 1 + orderedCriteriaIds.length) % orderedCriteriaIds.length;
        } else { // ArrowDown or TabForward
            nextIndex = (currentIndex + 1) % orderedCriteriaIds.length;
        }

        const nextCriterionId = orderedCriteriaIds[nextIndex];
        const nextInput = document.querySelector(`input[data-criterion-id='${nextCriterionId}']`) as HTMLInputElement;
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    };

    const progressPercentage = allCriteriaAndMissions.length > 0 ? (scoredCriteriaCount / allCriteriaAndMissions.length) * 100 : 0;

    const submitButtonTitle = isFormComplete
        ? (isBeforeMinTime ? `You must wait at least ${minTime / 60} minutes before submitting.` : 'Submit your final marks')
        : 'Please fill in all scores and feedback sections to submit';

    if (conflictError) {
        return (
            <Card className="bg-red-100 dark:bg-red-900/40 border border-red-400 text-center p-8">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-red-800 dark:text-red-300">Conflict of Interest Detected</h2>
                <p className="text-red-700 dark:text-red-400 mt-2">{conflictError}</p>
                <Button onClick={() => navigate('/dashboard')} className="mt-6">Back to Dashboard</Button>
            </Card>
        );
    }

    if (!project || !assignment || sections.length === 0) {
        return <Card><p>Loading judging assignment...</p></Card>;
    }

    const reviewScoresData = otherJudgeAssignments.map(a => {
        const judge = users.find(u => u.id === a.judgeId);
        return { judgeName: judge?.name || 'Unknown', score: a.score }
    });

    return (
        <fieldset disabled={isSessionExpired} className="space-y-6">
            <Modal
                isOpen={isSessionExpired}
                onClose={() => { }} // Non-dismissible
                title="Judging Session Expired"
            >
                <div className="text-center">
                    <p className="text-text-muted-light dark:text-text-muted-dark mb-4">
                        The active judging period has ended. Your progress has been saved. You can continue during the next session.
                    </p>
                    <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
                </div>
            </Modal>
            <Card className="sticky top-0 z-20">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">{project.title}</h1>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">{project.category} | {project.school}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 p-2 rounded-md transition-colors ${sessionStartTime === null ? 'bg-gray-100 dark:bg-gray-800' : 'bg-secondary/10'} text-secondary dark:text-accent-green`} title={`Session Timer. Min: ${minTime / 60}m, Max: ${maxTime / 60}m`}>
                            <Clock className={`w-5 h-5 ${sessionStartTime === null ? 'text-gray-400' : ''}`} />
                            <span className="font-mono font-semibold text-lg">
                                {formatTime(displayTime)} / {formatTime(maxTime)}
                            </span>
                            {sessionStartTime === null && <div className="text-xs text-gray-500 italic ml-2 hidden sm:block">Starts on first entry</div>}
                            {isBeforeMinTime && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Minimum time not reached"></div>}
                        </div>
                        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!isFormComplete || isSubmitting || isBeforeMinTime}
                            title={submitButtonTitle}
                            className="flex items-center gap-2"
                        >
                            {isSubmitting ? 'Submitting...' : <><Check className="w-4 h-4" /> Submit</>}
                        </Button>
                    </div>
                </div>
                {generalError && (
                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 rounded-md text-red-700 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <p>{generalError}</p>
                    </div>
                )}
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Progress</span>
                        <span className="text-sm font-bold text-primary">{scoredCriteriaCount} / {allCriteriaAndMissions.length} Scored</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div className="bg-primary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                </div>
            </Card>

            {isReviewMode && (
                <Card className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400">
                    <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">Coordinator Review Mode</h3>
                    {isCoordinatorReview ? (
                        <p className="text-yellow-700 dark:text-yellow-400 text-sm">You are arbitrating this project due to a scoring conflict. To ensure an impartial evaluation, the other judges' scores have been hidden. Your score will be used to resolve the discrepancy.</p>
                    ) : (
                        <p className="text-yellow-700 dark:text-yellow-400 text-sm">You are viewing this project because of a high score variance between the two assigned judges. Your score will be used to stike a balance point.</p>
                    )}
                </Card>
            )}

            {sections.map((section, index) => {
                let lastRenderedSubSection: string | undefined = undefined;
                return (
                    <Card key={section.id} ref={index === 0 ? firstCriterionCardRef : undefined}>
                        <div className="bg-primary/10 p-4 rounded-lg mb-4">
                            <h2 className="text-xl font-bold text-secondary dark:text-accent-green">{section.title}</h2>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">
                                {section.description}
                            </p>
                        </div>

                        {section.isRoboticsMissions ? (
                            <RoboticsMissionsInput
                                missionData={section.roboticsMissions}
                                scores={scores}
                                onUpdate={handleScoreUpdate}
                                onValidate={handleScoreValidation}
                                onKeyDown={handleKeyDown}
                                errors={errors}
                                studentMissionTexts={studentMissionTexts}
                                onStudentMissionTextChange={handleStudentMissionTextChange}
                            />
                        ) : (
                            <div className="space-y-3">
                                {section.criteria.map(criterion => {
                                    const currentSubSection = criterion.originalSection;
                                    const showHeader = currentSubSection && currentSubSection !== lastRenderedSubSection && section.subSectionDetails;
                                    if (showHeader) {
                                        lastRenderedSubSection = currentSubSection;
                                    }

                                    const subSectionInfo = (section.subSectionDetails && currentSubSection) ? section.subSectionDetails[currentSubSection] : null;

                                    return (
                                        <React.Fragment key={criterion.id}>
                                            {showHeader && subSectionInfo && (
                                                <div className="pt-6 mt-6 border-t-2 border-primary/50">
                                                    <h3 className="text-xl font-bold text-secondary dark:text-accent-green">{subSectionInfo.title}</h3>
                                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">{subSectionInfo.description}</p>
                                                </div>
                                            )}
                                            <CriterionInput
                                                criterion={criterion}
                                                value={scores[criterion.id] ?? ''}
                                                reviewScores={isReviewMode && !isCoordinatorReview ? reviewScoresData : undefined}
                                                error={errors[criterion.id]}
                                                onUpdate={handleScoreUpdate}
                                                onValidate={handleScoreValidation}
                                                onKeyDown={handleKeyDown}
                                            />
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        )}
                    </Card>
                )
            })}

            <Card>
                <h3 className="text-xl font-bold text-secondary dark:text-accent-green mb-4">Feedback & Recommendations</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="comments" className="block font-medium text-text-light dark:text-text-dark">General Comments <span className="text-red-500">*</span></label>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={generateAiComments}
                                disabled={isAiLoading || scoredCriteriaCount === 0}
                                title={scoredCriteriaCount === 0 ? "Enter some scores to enable AI feedback" : "Generate feedback based on scores"}
                                className="flex items-center gap-1"
                            >
                                {isAiLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isAiLoading ? 'Generating...' : 'Generate with AI'}
                            </Button>
                        </div>
                        <textarea
                            id="comments"
                            rows={4}
                            value={comments}
                            onChange={(e) => { handleFormInteraction(); setComments(e.target.value); setGeneralError(''); }}
                            className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary"
                            placeholder="Provide overall feedback on the project's strengths and weaknesses..."
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="recommendations" className="block mb-1 font-medium text-text-light dark:text-text-dark">Recommendations for Improvement <span className="text-red-500">*</span></label>
                        <textarea
                            id="recommendations"
                            rows={4}
                            value={recommendations}
                            onChange={(e) => { handleFormInteraction(); setRecommendations(e.target.value); setGeneralError(''); }}
                            className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary"
                            placeholder="Suggest specific ways the students can improve their project..."
                            required
                        />
                    </div>
                </div>
            </Card>
        </fieldset>
    );
};
