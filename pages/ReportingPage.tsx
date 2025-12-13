import React, { useContext, useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { AppContext } from '../context/AppContext';
import { Project, UserRole, RankedEntity, CompetitionLevel, ProjectWithRank, JudgeAssignment, User } from '../types';
import { Download, Search, FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';
import JurisdictionFilter, { FilterState } from '../components/admin/JurisdictionFilter';
import { SCORE_SHEET, ROBOTICS_SCORE_SHEET } from '../constants';
import { saveProfileOrFile } from '../utils/downloadUtils';

// Helper function to format strings to Title Case
const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

type RankingType = 'school' | 'zone' | 'subCounty' | 'county' | 'region';
type ActiveView = 'broadsheet' | 'summary';

// Define criteria sets for score breakdown calculations
const bcCriteria = SCORE_SHEET.find(s => s.id === 'BC')?.criteria || [];
const bCriteriaIds = new Set<number>(bcCriteria.filter(c => c.originalSection === 'B').map(c => c.id));
const cCriteriaIds = new Set<number>(bcCriteria.filter(c => c.originalSection === 'C').map(c => c.id));
const roboticsBCriteria = ROBOTICS_SCORE_SHEET.find(s => s.id === 'B')?.criteria || [];
const roboticsBCriteriaIds = new Set<number>(roboticsBCriteria.map(c => c.id));
const roboticsMissionsSection = ROBOTICS_SCORE_SHEET.find(s => s.id === 'C') as any;
const roboticsMissions = roboticsMissionsSection?.roboticsMissions;
const roboticsCCriteriaIds = roboticsMissions ? new Set<number>([...roboticsMissions.compulsory.map((m: any) => m.id), ...roboticsMissions.studentGenerated.map((m: any) => m.id)]) : new Set<number>();

// --- NEW HELPER to calculate B & C scores from a breakdown ---
const calculateB_C_Scores = (breakdown: { [key: number]: number } | null | undefined, category: string) => {
    let scoreB: number | null = null;
    let scoreC: number | null = null;

    if (breakdown && Object.keys(breakdown).length > 0) {
        scoreB = 0;
        scoreC = 0;
        const isRobotics = category === 'Robotics';
        const currentBCriteriaIds = isRobotics ? roboticsBCriteriaIds : bCriteriaIds;
        const currentCCriteriaIds = isRobotics ? roboticsCCriteriaIds : cCriteriaIds;

        for (const key in breakdown) {
            const critId = parseInt(key);
            if (currentBCriteriaIds.has(critId)) {
                scoreB += breakdown[key];
            } else if (currentCCriteriaIds.has(critId)) {
                scoreC += breakdown[key];
            }
        }
    }
    return { scoreB, scoreC };
};


// --- START: SUB-COMPONENTS FOR REPORTING PAGE ---

const ProjectSummaryDisplay: React.FC<{ data: { [category: string]: any[] }, onDownload: () => void, isDownloading: boolean }> = ({ data, onDownload, isDownloading }) => {
    const categories = Object.keys(data).sort();
    const hasData = categories.some(cat => data[cat] && data[cat].length > 0);

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={onDownload} disabled={!hasData || isDownloading} className="flex items-center gap-2">
                    {isDownloading ? <Loader2 className="animate-spin" /> : <Download />} {isDownloading ? 'Processing...' : 'Download Summary (PDF)'}
                </Button>
            </div>
            {hasData ? (
                <div className="space-y-8">
                    {categories.map(category => (
                        <div key={category}>
                            <h3 className="text-xl font-bold text-secondary dark:text-accent-green mb-2">{category}</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-800/50 text-text-muted-light dark:text-text-muted-dark">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Reg. No</th>
                                            <th className="px-4 py-3 text-left">Title</th>
                                            <th className="px-4 py-3 text-left">School</th>
                                            <th className="px-4 py-3 text-right">Score</th>
                                            <th className="px-4 py-3 text-right">Points</th>
                                            <th className="px-4 py-3 text-right">Rank</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data[category].map(p => (
                                            <tr key={p.id} className="border-b dark:border-gray-700 text-text-light dark:text-text-dark">
                                                <td className="px-4 py-3 font-mono text-xs">{p.projectRegistrationNumber}</td>
                                                <td className="px-4 py-3 font-medium">{p.title}</td>
                                                <td className="px-4 py-3">{p.school}</td>
                                                <td className="px-4 py-3 text-right font-semibold">{p.totalScore !== null ? p.totalScore.toFixed(2) : 'N/A'}</td>
                                                <td className="px-4 py-3 text-right">{p.points !== null ? p.points : 'N/A'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-primary">{p.categoryRank !== null ? p.categoryRank : 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">No projects found for the selected filters.</p>
            )}
        </div>
    );
};


const ProjectBroadsheetDisplay: React.FC<{ data: any, users: User[] }> = ({ data, users }) => {
    if (Object.keys(data).length === 0) {
        return <p className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">No projects with judging data found for the selected filters.</p>;
    }

    return (
        <div className="space-y-8 overflow-x-auto">
            {Object.entries(data).map(([category, categoryData]: [string, any]) => {
                const { judges, projects } = categoryData;
                const userMap = new Map(users.map(u => [u.id, u.name]));

                // Check if any coordinator has submitted a score for any project in this category.
                const hasCoordinatorScores = projects.some((p: any) =>
                    Object.values(p.coordinatorScores).some((scores: any) =>
                        (scores.scoreA !== null && scores.scoreA !== undefined) ||
                        (scores.scoreB !== null && scores.scoreB !== undefined) ||
                        (scores.scoreC !== null && scores.scoreC !== undefined)
                    )
                );

                const partAJudges = judges.partA.map((j: any) => ({ id: j.id, name: userMap.get(j.id) || 'Unknown Judge' }));
                const partBCJudges = judges.partBC.map((j: any) => ({ id: j.id, name: userMap.get(j.id) || 'Unknown Judge' }));

                // Only include coordinators for rendering if they have scored something.
                const coordinators = hasCoordinatorScores
                    ? judges.coordinators.map((c: any) => ({ id: c.id, name: userMap.get(c.id) || 'Unknown Coordinator' }))
                    : [];

                const isRobotics = category === 'Robotics';
                const maxA = 30;
                const maxB = isRobotics ? 20 : 15;
                const maxC = isRobotics ? 50 : 35;


                return (
                    <div key={category}>
                        <h3 className="text-xl font-bold text-secondary dark:text-accent-green mb-2">{category}</h3>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-200 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark">
                                    <th className="border p-1" rowSpan={2}>Student name(s)</th>
                                    <th className="border p-1" rowSpan={2}>School</th>
                                    <th className="border p-1" rowSpan={2}>Project Title</th>
                                    {partAJudges.length > 0 && <th className="border p-1" colSpan={partAJudges.length}>Section A/{maxA}</th>}
                                    {partBCJudges.length > 0 && <th className="border p-1" colSpan={partBCJudges.length}>Section B/{maxB}</th>}
                                    {partBCJudges.length > 0 && <th className="border p-1" colSpan={partBCJudges.length}>Section C/{maxC}</th>}

                                    {coordinators.length === 1 && <th className="border p-1" colSpan={3}>Coordinator ({coordinators[0].name})</th>}
                                    {coordinators.length > 1 && <th className="border p-1" colSpan={coordinators.length * 3}>Coordinators</th>}

                                    <th className="border p-1" colSpan={3}>Averages</th>
                                    <th className="border p-1" rowSpan={2}>Total</th>
                                    <th className="border p-1" rowSpan={2}>Rank</th>
                                </tr>
                                <tr className="bg-gray-100 dark:bg-gray-700 text-text-muted-light dark:text-text-muted-dark">
                                    {partAJudges.map((j: any) => <th key={j.id} className="border p-1 font-normal">{j.name}</th>)}
                                    {partBCJudges.map((j: any) => <th key={j.id} className="border p-1 font-normal">{j.name}</th>)}
                                    {partBCJudges.map((j: any) => <th key={j.id} className="border p-1 font-normal">{j.name}</th>)}

                                    {coordinators.length === 1 && [
                                        <th key={`${coordinators[0].id}-a`} className="border p-1 font-normal">A</th>,
                                        <th key={`${coordinators[0].id}-b`} className="border p-1 font-normal">B</th>,
                                        <th key={`${coordinators[0].id}-c`} className="border p-1 font-normal">C</th>
                                    ]}
                                    {coordinators.length > 1 && coordinators.flatMap((c: any) => [
                                        <th key={`${c.id}-a`} className="border p-1 font-normal">{c.name} (A)</th>,
                                        <th key={`${c.id}-b`} className="border p-1 font-normal">{c.name} (B)</th>,
                                        <th key={`${c.id}-c`} className="border p-1 font-normal">{c.name} (C)</th>
                                    ])}

                                    <th className="border p-1">Sec A/{maxA}</th>
                                    <th className="border p-1">Sec B/{maxB}</th>
                                    <th className="border p-1">Sec C/{maxC}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p: any) => (
                                    <tr key={p.id} className="border-b dark:border-gray-700 text-text-light dark:text-text-dark">
                                        <td className="border p-1">{p.students.join(', ')}</td>
                                        <td className="border p-1">{p.school}</td>
                                        <td className="border p-1">{p.title}</td>

                                        {partAJudges.map((j: any) => <td key={j.id} className="border p-1 text-center">{p.judgeScores[j.id]?.['Part A']?.toFixed(2) ?? '-'}</td>)}
                                        {partBCJudges.map((j: any) => <td key={j.id} className="border p-1 text-center">{p.judgeScores[j.id]?.['Part B']?.toFixed(2) ?? '-'}</td>)}
                                        {partBCJudges.map((j: any) => <td key={j.id} className="border p-1 text-center">{p.judgeScores[j.id]?.['Part C']?.toFixed(2) ?? '-'}</td>)}

                                        {coordinators.flatMap((c: any) => [
                                            <td key={`${c.id}-a`} className="border p-1 text-center">{p.coordinatorScores[c.id]?.scoreA?.toFixed(2) ?? '-'}</td>,
                                            <td key={`${c.id}-b`} className="border p-1 text-center">{p.coordinatorScores[c.id]?.scoreB?.toFixed(2) ?? '-'}</td>,
                                            <td key={`${c.id}-c`} className="border p-1 text-center">{p.coordinatorScores[c.id]?.scoreC?.toFixed(2) ?? '-'}</td>
                                        ])}

                                        <td className="border p-1 text-center font-semibold">{p.averages.scoreA?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="border p-1 text-center font-semibold">{p.averages.scoreB?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="border p-1 text-center font-semibold">{p.averages.scoreC?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="border p-1 text-center font-bold bg-gray-100 dark:bg-gray-800">{p.totalScore?.toFixed(2) ?? 'N/A'}</td>
                                        <td className="border p-1 text-center font-bold bg-gray-100 dark:bg-gray-800">{p.rank ?? 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};


const EntityRankingsDisplay: React.FC<{
    rankedEntities: RankedEntity[],
    entityTypeLabel: string,
    rankingType: RankingType,
    setRankingType: (type: RankingType) => void,
    searchTerm: string,
    setSearchTerm: (term: string) => void,
}> = ({ rankedEntities, entityTypeLabel, rankingType, setRankingType, searchTerm, setSearchTerm }) => (
    <Card>
        <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-4">Entity Rankings</h2>
        <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                {(['school', 'zone', 'subCounty', 'county', 'region'] as RankingType[]).map(type => (
                    <Button key={type} size="sm" variant={rankingType === type ? 'secondary' : 'ghost'} onClick={() => setRankingType(type)}>
                        {toTitleCase(type.replace('County', ' County'))}
                    </Button>
                ))}
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder={`Search ${entityTypeLabel}s...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-9 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600"
                />
            </div>
        </div>
        <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
                <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-800/50 text-text-muted-light dark:text-text-muted-dark">
                    <tr>
                        <th className="px-4 py-3 text-left">Rank</th>
                        <th className="px-4 py-3 text-left">{entityTypeLabel}</th>
                        <th className="px-4 py-3 text-right">Total Points</th>
                    </tr>
                </thead>
                <tbody>
                    {rankedEntities.map(entity => (
                        <tr key={entity.name} className="border-b dark:border-gray-700">
                            <td className="px-4 py-3 font-bold text-lg text-primary">{entity.rank}</td>
                            <td className="px-4 py-3 font-medium">{entity.name}</td>
                            <td className="px-4 py-3 text-right font-semibold">{entity.totalPoints.toFixed(0)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {rankedEntities.length === 0 && (
                <p className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">No ranking data available for the selected filters.</p>
            )}
        </div>
    </Card>
);

// --- END: SUB-COMPONENTS ---


export const ReportingPage: React.FC = () => {
    const {
        user,
        users,
        projects,
        assignments,
        calculateProjectScores,
        calculateProjectScoresWithBreakdown,
        calculateRankingsAndPointsForProjects,
        viewingLevel,
    } = useContext(AppContext);

    const [activeView, setActiveView] = useState<ActiveView>('broadsheet');
    const [filter, setFilter] = useState<FilterState>(() => {
        if (!user) return { region: 'All', county: 'All', subCounty: 'All' };
        const isAdmin = [UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN].includes(user.currentRole);
        return {
            region: (isAdmin ? user.workRegion : user.region) || 'All',
            county: (isAdmin ? user.workCounty : user.county) || 'All',
            subCounty: (isAdmin ? user.workSubCounty : user.subCounty) || 'All'
        };
    });
    const [rankingType, setRankingType] = useState<RankingType>('school');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const isAdmin = user && [UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN].includes(user.currentRole);

    const { relevantProjects, rankingData, rankedEntities, entityTypeLabel } = useMemo(() => {
        // This logic remains largely the same
        let projectsToRank = projects.filter(p => {
            const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
            const projectLevelIndex = levelOrder.indexOf(p.currentLevel);
            const viewingLevelIndex = levelOrder.indexOf(viewingLevel);
            if (projectLevelIndex < viewingLevelIndex) return false;
            if (p.isEliminated && projectLevelIndex < viewingLevelIndex) return false;
            return true;
        });

        if (filter.region !== 'All') projectsToRank = projectsToRank.filter(p => p.region === filter.region);
        if (filter.county !== 'All') projectsToRank = projectsToRank.filter(p => p.county === filter.county);
        if (filter.subCounty !== 'All') projectsToRank = projectsToRank.filter(p => p.subCounty === filter.subCounty);

        const data = calculateRankingsAndPointsForProjects(projectsToRank, viewingLevel);

        let entities: RankedEntity[] = [];
        let label = 'School';

        switch (rankingType) {
            case 'school': entities = data.schoolRanking; label = 'School'; break;
            case 'zone': entities = Object.values(data.zoneRanking).flat() as RankedEntity[]; label = 'Zone'; break;
            case 'subCounty': entities = Object.values(data.subCountyRanking).flat() as RankedEntity[]; label = 'Sub-County'; break;
            case 'county': entities = Object.values(data.countyRanking).flat() as RankedEntity[]; label = 'County'; break;
            case 'region': entities = data.regionRanking; label = 'Region'; break;
        }

        if (searchTerm) {
            entities = entities.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        return { relevantProjects: projectsToRank, rankingData: data, rankedEntities: entities, entityTypeLabel: label };
    }, [projects, viewingLevel, filter, rankingType, searchTerm, calculateRankingsAndPointsForProjects]);

    // Data for the old "Summary" view
    const summaryData = useMemo(() => {
        if (!rankingData) {
            // FIX: Guard against null rankingData to prevent runtime errors.
            return relevantProjects.map(project => ({ ...project, totalScore: null, points: null, categoryRank: null, }));
        }
        // FIX: Explicitly type the Map to ensure `rankedData` is correctly inferred as `ProjectWithRank`.
        const rankedProjectsMap = new Map<string, ProjectWithRank>(rankingData.projectsWithPoints.map(p => [p.id, p]));
        return relevantProjects.map(project => {
            const rankedData = rankedProjectsMap.get(project.id);
            // FIX: Add type assertion to resolve 'unknown' type error on property access.
            if (rankedData) return { ...project, totalScore: (rankedData as ProjectWithRank).totalScore, points: (rankedData as ProjectWithRank).points, categoryRank: (rankedData as ProjectWithRank).categoryRank };
            const scores = calculateProjectScores(project.id, viewingLevel);
            return { ...project, totalScore: (scores.scoreA !== null || scores.scoreBC !== null) ? scores.totalScore : null, points: null, categoryRank: null, };
        });
    }, [relevantProjects, rankingData, calculateProjectScores, viewingLevel]);

    const groupedSummaryData = useMemo(() => {
        const grouped = summaryData.reduce((acc, project) => {
            const category = project.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(project);
            return acc;
        }, {} as { [category: string]: typeof summaryData });

        // Sort projects within each category by rank
        for (const category in grouped) {
            grouped[category].sort((a, b) => (a.categoryRank ?? Infinity) - (b.categoryRank ?? Infinity));
        }

        return grouped;
    }, [summaryData]);


    // Data for the new "Broadsheet" view
    const detailedBroadsheetData = useMemo(() => {
        const projectsWithScores = relevantProjects.map(p => {
            const scores = calculateProjectScoresWithBreakdown(p.id, viewingLevel);
            const rankInfo = rankingData.projectsWithPoints.find(rp => rp.id === p.id);
            return {
                ...p,
                averages: { scoreA: scores.scoreA, scoreB: scores.scoreB, scoreC: scores.scoreC },
                totalScore: scores.totalScore,
                rank: rankInfo?.categoryRank,
            };
        });

        const byCategory = projectsWithScores.reduce((acc, p) => {
            if (!acc[p.category]) acc[p.category] = [];
            acc[p.category].push(p);
            return acc;
        }, {} as { [category: string]: typeof projectsWithScores });

        const finalData: { [category: string]: any } = {};

        for (const category in byCategory) {
            const categoryProjects = byCategory[category];
            // Sort projects by rank, ascending. Projects without a rank go to the end.
            categoryProjects.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

            // --- FIX: Logic to historically identify judges and coordinators ---
            const judgeCollector = { partA: new Set<string>(), partBC: new Set<string>(), coordinators: new Set<string>() };

            const allAssignmentsForCategory = assignments.filter(a => {
                const proj = projects.find(p => p.id === a.projectId);
                return proj && proj.category === category && a.competitionLevel === viewingLevel;
            });

            const assignmentsByJudge = allAssignmentsForCategory.reduce((acc, a) => {
                if (!acc[a.judgeId]) acc[a.judgeId] = new Set<string>();
                acc[a.judgeId].add(a.assignedSection);
                return acc;
            }, {} as Record<string, Set<string>>);

            for (const judgeId in assignmentsByJudge) {
                const sections = assignmentsByJudge[judgeId];
                if (sections.has('Part A') && sections.has('Part B & C')) {
                    judgeCollector.coordinators.add(judgeId);
                } else if (sections.has('Part A')) {
                    judgeCollector.partA.add(judgeId);
                } else if (sections.has('Part B & C')) {
                    judgeCollector.partBC.add(judgeId);
                }
            }
            judgeCollector.coordinators.forEach(coordId => {
                judgeCollector.partA.delete(coordId);
                judgeCollector.partBC.delete(coordId);
            });

            const projectsData = categoryProjects.map(p => {
                const projectAssignments = allAssignmentsForCategory.filter(a => a.projectId === p.id);
                const judgeScores: { [judgeId: string]: { 'Part A'?: number | null, 'Part B'?: number | null, 'Part C'?: number | null } } = {};
                const coordinatorScores: { [coordId: string]: { scoreA?: number | null, scoreB?: number | null, scoreC?: number | null } } = {};

                projectAssignments.forEach(a => {
                    if (judgeCollector.coordinators.has(a.judgeId)) {
                        if (!coordinatorScores[a.judgeId]) coordinatorScores[a.judgeId] = {};
                        if (a.assignedSection === 'Part A') {
                            coordinatorScores[a.judgeId].scoreA = a.score ?? null;
                        } else {
                            const { scoreB, scoreC } = calculateB_C_Scores(a.scoreBreakdown, p.category);
                            coordinatorScores[a.judgeId].scoreB = scoreB;
                            coordinatorScores[a.judgeId].scoreC = scoreC;
                        }
                    } else {
                        if (!judgeScores[a.judgeId]) judgeScores[a.judgeId] = {};
                        if (a.assignedSection === 'Part A') {
                            judgeScores[a.judgeId]['Part A'] = a.score;
                        } else {
                            const { scoreB, scoreC } = calculateB_C_Scores(a.scoreBreakdown, p.category);
                            judgeScores[a.judgeId]['Part B'] = scoreB;
                            judgeScores[a.judgeId]['Part C'] = scoreC;
                        }
                    }
                });

                return { ...p, judgeScores, coordinatorScores };
            });

            finalData[category] = {
                judges: {
                    partA: Array.from(judgeCollector.partA).map(id => ({ id })),
                    partBC: Array.from(judgeCollector.partBC).map(id => ({ id })),
                    coordinators: Array.from(judgeCollector.coordinators).map(id => ({ id })),
                },
                projects: projectsData,
            };
            // --- END FIX ---
        }
        return finalData;

    }, [relevantProjects, assignments, users, viewingLevel, rankingData, calculateProjectScoresWithBreakdown, projects]);


    const handleDownloadSummary = async () => {
        setIsDownloading(true);
        // Small timeout to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.setFontSize(16);
            doc.text(`KSEF Project Summary - ${viewingLevel} Level`, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

            const categories = Object.keys(groupedSummaryData).sort();
            const hasData = categories.some(cat => groupedSummaryData[cat].length > 0);
            if (!hasData) {
                return;
            }

            let lastFinalY = 20;

            categories.forEach(category => {
                const projectsInCategory = groupedSummaryData[category];
                if (projectsInCategory.length === 0) return;

                // Auto page break logic
                const neededHeight = 10 + 10 + (projectsInCategory.length * 10); // Rough estimate
                if (lastFinalY > 20 && lastFinalY + neededHeight > doc.internal.pageSize.getHeight()) {
                    doc.addPage();
                    lastFinalY = 20;
                }

                const startY = lastFinalY + (lastFinalY > 20 ? 10 : 0);

                doc.setFontSize(14);
                doc.setTextColor(40);
                doc.setFont(undefined, 'bold');
                doc.text(category, 14, startY);

                const head = [['Reg. No', 'Title', 'School', 'Score', 'Points', 'Rank']];
                const body = projectsInCategory.map(p => [
                    p.projectRegistrationNumber,
                    p.title,
                    p.school,
                    p.totalScore !== null ? p.totalScore.toFixed(2) : 'N/A',
                    p.points !== null ? p.points : 'N/A',
                    p.categoryRank !== null ? p.categoryRank : 'N/A',
                ]);

                (doc as any).autoTable({
                    startY: startY + 5,
                    head: head,
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [220, 220, 220], textColor: 0 },
                });

                lastFinalY = (doc as any).lastAutoTable.finalY;
            });

            await saveProfileOrFile(doc, `KSEF_Summary_${viewingLevel}.pdf`);
        } catch (error) {
            console.error("Download failed:", error);
            // You might want to show a toast here via showNotification if available
            alert("Download failed. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadBroadsheet = async () => {
        setIsDownloading(true);
        // Small timeout to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
            const userMap = new Map(users.map(u => [u.id, u.name]));
            let isFirstPage = true;

            Object.entries(detailedBroadsheetData).forEach(([category, categoryData]: [string, any]) => {
                // FIX: Corrected the arguments for jsPDF's 'addPage' method.
                if (!isFirstPage) doc.addPage('a3', 'landscape');
                isFirstPage = false;

                doc.setFontSize(16);
                doc.text(`KSEF RESULTS BROADHEET - ${viewingLevel} Level`, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
                doc.setFontSize(14);
                doc.text(`CATEGORY: ${category.toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

                const { judges, projects } = categoryData;

                const partAJudges = judges.partA.map((j: any) => ({ id: j.id, name: userMap.get(j.id) || 'Unknown' }));
                const partBCJudges = judges.partBC.map((j: any) => ({ id: j.id, name: userMap.get(j.id) || 'Unknown' }));
                const coordinators = judges.coordinators.map((c: any) => ({ id: c.id, name: userMap.get(c.id) || 'Unknown' }));

                const head: any[][] = [];
                const head1: any[] = [
                    { content: 'Student(s)', rowSpan: 2 }, { content: 'School', rowSpan: 2 }, { content: 'Project Title', rowSpan: 2 },
                ];
                const head2: any[] = [];

                if (partAJudges.length > 0) head1.push({ content: 'Section A', colSpan: partAJudges.length });
                if (partBCJudges.length > 0) head1.push({ content: 'Section B', colSpan: partBCJudges.length });
                if (partBCJudges.length > 0) head1.push({ content: 'Section C', colSpan: partBCJudges.length });
                if (coordinators.length > 0) head1.push({ content: 'Coordinator', colSpan: coordinators.length * 3 });
                head1.push({ content: 'Averages', colSpan: 3 }, { content: 'Total', rowSpan: 2 }, { content: 'Rank', rowSpan: 2 });

                partAJudges.forEach(j => head2.push(j.name));
                partBCJudges.forEach(j => head2.push(j.name));
                partBCJudges.forEach(j => head2.push(j.name));
                coordinators.forEach(c => { head2.push(`${c.name} (A)`); head2.push(`${c.name} (B)`); head2.push(`${c.name} (C)`); });
                head2.push('Sec A/30', 'Sec B/15', 'Sec C/35');
                head.push(head1, head2);

                const body = projects.map((p: any) => {
                    const row = [p.students.join('\n'), p.school, p.title];
                    partAJudges.forEach(j => row.push(p.judgeScores[j.id]?.['Part A']?.toFixed(2) ?? '-'));
                    partBCJudges.forEach(j => row.push(p.judgeScores[j.id]?.['Part B']?.toFixed(2) ?? '-'));
                    partBCJudges.forEach(j => row.push(p.judgeScores[j.id]?.['Part C']?.toFixed(2) ?? '-'));
                    coordinators.forEach(c => {
                        row.push(p.coordinatorScores[c.id]?.scoreA?.toFixed(2) ?? '-');
                        row.push(p.coordinatorScores[c.id]?.scoreB?.toFixed(2) ?? '-');
                        row.push(p.coordinatorScores[c.id]?.scoreC?.toFixed(2) ?? '-');
                    });
                    row.push(p.averages.scoreA?.toFixed(2) ?? 'N/A', p.averages.scoreB?.toFixed(2) ?? 'N/A', p.averages.scoreC?.toFixed(2) ?? 'N/A');
                    row.push(p.totalScore?.toFixed(2) ?? 'N/A', p.rank ?? 'N/A');
                    return row;
                });

                (doc as any).autoTable({ startY: 30, head: head, body, theme: 'grid', styles: { fontSize: 8 } });
            });

            await saveProfileOrFile(doc, `KSEF_Broadsheet_${viewingLevel}.pdf`);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Download failed. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Reporting & Analytics</h1>
            <CompetitionLevelSwitcher />

            {isAdmin && <JurisdictionFilter filter={filter} onFilterChange={setFilter} />}

            <Card>
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <Button variant="ghost" onClick={() => setActiveView('broadsheet')} className={`!rounded-b-none ${activeView === 'broadsheet' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}><FileText className="w-4 h-4 mr-2" /> Project Broadsheet</Button>
                    <Button variant="ghost" onClick={() => setActiveView('summary')} className={`!rounded-b-none ${activeView === 'summary' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}><FileText className="w-4 h-4 mr-2" /> Project Summary</Button>
                </div>

                {activeView === 'broadsheet' && (
                    <>
                        <div className="flex justify-end mb-4">
                            <Button onClick={handleDownloadBroadsheet} disabled={Object.keys(detailedBroadsheetData).length === 0 || isDownloading} className="flex items-center gap-2">
                                {isDownloading ? <Loader2 className="animate-spin" /> : <Download />} {isDownloading ? 'Processing...' : 'Download Broadsheet (PDF)'}
                            </Button>
                        </div>
                        <ProjectBroadsheetDisplay data={detailedBroadsheetData} users={users} />
                    </>
                )}
                {activeView === 'summary' && <ProjectSummaryDisplay data={groupedSummaryData} onDownload={handleDownloadSummary} isDownloading={isDownloading} />}
            </Card>

            <EntityRankingsDisplay
                rankedEntities={rankedEntities}
                entityTypeLabel={entityTypeLabel}
                rankingType={rankingType}
                setRankingType={setRankingType}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
            />
        </div>
    );
};
