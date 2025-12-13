import React, { useContext, useMemo, useState, useEffect } from 'react';
import { FileDown, Users, CheckCircle, AlertTriangle, FileText, BarChart, Shield, UserCheck, UserCircle, Send, Clock, Edit, Trophy, ListChecks, Award, RotateCcw, Info, Award as CertificateIcon, Loader2 } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import Card from '../components/ui/Card';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import RegionBarChart from '../components/charts/RegionBarChart';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { AppContext, ProjectScores } from '../context/AppContext';
import { User, UserRole, ProjectStatus, CompetitionLevel, Project, ProjectWithRank, RankedEntity, AuditLog } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import TieBreakerModal from '../components/admin/TieBreakerModal';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';
import { addCertificatePage } from '../components/reports/CertificateGenerator';
import { saveProfileOrFile } from '../utils/downloadUtils';

const ADMIN_ROLES = [
    UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
    UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN
];

const JUDGE_ROLES = [UserRole.JUDGE, UserRole.COORDINATOR];

const ROLE_HIERARCHY_MAP: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 0,
    [UserRole.NATIONAL_ADMIN]: 1,
    [UserRole.REGIONAL_ADMIN]: 2,
    [UserRole.COUNTY_ADMIN]: 3,
    [UserRole.SUB_COUNTY_ADMIN]: 4,
    [UserRole.COORDINATOR]: 5,
    [UserRole.JUDGE]: 6,
    [UserRole.PATRON]: 7,
};

// Helper to format time since an event
const timeSince = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
};

// --- START: NEW AND MOVED COMPONENTS ---

const RecentActivityCard: React.FC<{ notifications: AuditLog[]; onRead: (logId: string) => void }> = ({ notifications, onRead }) => (
    <Card>
        <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Recent Activity</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {notifications.length > 0 ? notifications.map(log => (
                <div key={log.id} className={`p-3 rounded-lg border-l-4 ${log.is_read ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600' : 'bg-blue-50 dark:bg-blue-900/40 border-primary'}`} onClick={() => !log.is_read && onRead(log.id)}>
                    <p className="text-sm font-medium">{log.action}</p>
                    <div className="flex items-center gap-2 text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                        <UserCircle size={14} /> <span>{log.performing_admin_name}</span>
                        <Clock size={14} /> <span>{timeSince(new Date(log.timestamp))}</span>
                    </div>
                </div>
            )) : (
                <p className="text-center text-text-muted-light dark:text-text-muted-dark py-4">No recent activity from your managed administrators.</p>
            )}
        </div>
    </Card>
);

const LeaderboardCard: React.FC<{
    groupedProjects: { [category: string]: ProjectWithRank[] };
    relevantEntities: RankedEntity[];
    entityType: string;
}> = ({ groupedProjects, relevantEntities, entityType }) => {
    const [tab, setTab] = useState<'projects' | 'rankings'>('projects');

    return (
        <Card className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Live Leaderboard</h3>
                <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                    <Button size="sm" variant={tab === 'projects' ? 'secondary' : 'ghost'} onClick={() => setTab('projects')} className="flex items-center gap-1"><ListChecks size={16} /> Top Projects</Button>
                    <Button size="sm" variant={tab === 'rankings' ? 'secondary' : 'ghost'} onClick={() => setTab('rankings')} className="flex items-center gap-1"><Trophy size={16} /> {entityType} Ranking</Button>
                </div>
            </div>
            <div className="overflow-y-auto max-h-96 pr-2">
                {tab === 'projects' && (
                    Object.keys(groupedProjects).length > 0 ? (
                        <div className="space-y-4">
                            {(Object.entries(groupedProjects) as [string, ProjectWithRank[]][]).map(([category, projects]) => (
                                <div key={category}>
                                    <h4 className="font-semibold text-primary">{category}</h4>
                                    <ul className="space-y-1 mt-1">
                                        {projects.slice(0, 3).map(p => (
                                            <li key={p.id} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                                <div>
                                                    <p className="font-medium text-sm">{p.title}</p>
                                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{p.school}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm">{p.totalScore.toFixed(2)} pts</p>
                                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Rank #{p.categoryRank}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-text-muted-light dark:text-text-muted-dark">
                            <ListChecks className="mx-auto w-10 h-10 mb-2" />
                            <p>No projects have been fully judged yet.</p>
                        </div>
                    )
                )}
                {tab === 'rankings' && (
                    relevantEntities.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-text-muted-light dark:text-text-muted-dark">
                                    <th className="p-2">Rank</th>
                                    <th className="p-2">{entityType}</th>
                                    <th className="p-2 text-right">Total Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {relevantEntities.slice(0, 10).map(entity => (
                                    <tr key={entity.name} className="border-t dark:border-gray-700">
                                        <td className="p-2 font-bold text-lg text-primary">{entity.rank}</td>
                                        <td className="p-2 font-medium">{entity.name}</td>
                                        <td className="p-2 text-right font-semibold">{entity.totalPoints.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-10 text-text-muted-light dark:text-text-muted-dark">
                            <Trophy className="mx-auto w-10 h-10 mb-2" />
                            <p>No ranking data available yet.</p>
                        </div>
                    )
                )}
            </div>
        </Card>
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

// --- END: NEW AND MOVED COMPONENTS ---


const AdminDashboard: React.FC = () => {
    // FIX: Add calculateProjectScoresWithBreakdown to the context destructuring.
    const { user, users, projects, assignments, calculateProjectScores, calculateProjectScoresWithBreakdown, calculateRankingsAndPointsForProjects, publishResults, unpublishResults, isRollbackPossible, auditLogs, markAuditLogAsRead, updateProject, showNotification, schoolData, submissionDeadline, isLoading, isHistoricalView, viewingLevel, overallHighestLevel, activeEdition } = useContext(AppContext);
    const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
    const [isUnpublishConfirmModalOpen, setUnpublishConfirmModalOpen] = useState(false);
    const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [tieBreakState, setTieBreakState] = useState<{ isOpen: boolean, project: Project | null, scores: ProjectScores | null }>({ isOpen: false, project: null, scores: null });
    const [isDownloading, setIsDownloading] = useState(false);

    const isDeadlinePassed = useMemo(() => {
        if (!submissionDeadline) return false; // If no deadline is set, it's not passed
        return new Date() > new Date(submissionDeadline);
    }, [submissionDeadline]);

    const myNotifications = useMemo(() => {
        if (!user) return [];
        return auditLogs.filter(log => {
            if (log.notified_admin_role !== user.currentRole) return false;
            switch (user.currentRole) {
                case UserRole.REGIONAL_ADMIN:
                    return log.scope?.region === user.region;
                case UserRole.COUNTY_ADMIN:
                    return log.scope?.region === user.region && log.scope?.county === user.county;
                case UserRole.NATIONAL_ADMIN:
                case UserRole.SUPER_ADMIN:
                    return true;
                default:
                    return false;
            }
        });
    }, [user, auditLogs]);

    const { adminLevel, nextLevel, isViewingPastLevel, isViewingActiveLevel } = useMemo(() => {
        if (!user) return { adminLevel: null, nextLevel: null, isViewingPastLevel: false, isViewingActiveLevel: false };
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const roleToLevelMap: { [key in UserRole]?: CompetitionLevel } = {
            [UserRole.SUB_COUNTY_ADMIN]: CompetitionLevel.SUB_COUNTY,
            [UserRole.COUNTY_ADMIN]: CompetitionLevel.COUNTY,
            [UserRole.REGIONAL_ADMIN]: CompetitionLevel.REGIONAL,
            [UserRole.NATIONAL_ADMIN]: CompetitionLevel.NATIONAL,
        };
        const currentAdminLevel = roleToLevelMap[user.currentRole];

        const viewingLevelIndex = levelOrder.indexOf(viewingLevel);
        const overallHighestLevelIndex = levelOrder.indexOf(overallHighestLevel);

        const nextCompetitionLevel = (viewingLevelIndex !== -1 && viewingLevelIndex < levelOrder.length - 1)
            ? levelOrder[viewingLevelIndex + 1]
            : null;

        return {
            adminLevel: currentAdminLevel,
            nextLevel: nextCompetitionLevel,
            isViewingPastLevel: viewingLevelIndex < overallHighestLevelIndex,
            isViewingActiveLevel: viewingLevel === overallHighestLevel,
        };
    }, [user, viewingLevel, overallHighestLevel]);

    const {
        projectsAtViewingLevel,
        userStats,
        areAllProjectsJudged,
        haveResultsBeenPublished,
        rankingData,
        scopedRankingData,
        tiesToResolve,
        completionPercentage,
        projectsInReview,
        categoryChartData,
        regionChartData,
        barChartTitle,
        activeJudgeIdsForLevel,
    } = useMemo(() => {
        if (!user) return { projectsAtViewingLevel: [], userStats: { all: 0, admins: 0, judgesInScope: 0, judgesActiveForLevel: 0, patrons: 0 }, areAllProjectsJudged: false, haveResultsBeenPublished: false, rankingData: null, scopedRankingData: { groupedProjects: {}, relevantEntities: [], entityType: '' }, tiesToResolve: [], completionPercentage: 0, projectsInReview: 0, categoryChartData: [], regionChartData: [], barChartTitle: '', activeJudgeIdsForLevel: new Set() };

        // 1. Geo-scope users based on ADMIN'S JURISDICTION (personal location)
        const geoScopedUsers = users.filter(u => {
            if ([UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole)) return true;
            if (u.id === user.id) return true; // Always include self
            // A user is in scope if their work/personal location matches the admin's jurisdiction
            const targetUserWorkRegion = u.workRegion || u.region;
            const targetUserWorkCounty = u.workCounty || u.county;
            const targetUserWorkSubCounty = u.workSubCounty || u.subCounty;
            if (user.currentRole === UserRole.REGIONAL_ADMIN) return targetUserWorkRegion === user.region;
            if (user.currentRole === UserRole.COUNTY_ADMIN) return targetUserWorkCounty === user.county && targetUserWorkRegion === user.region;
            if (user.currentRole === UserRole.SUB_COUNTY_ADMIN) return targetUserWorkSubCounty === user.subCounty && targetUserWorkCounty === user.county && targetUserWorkRegion === user.region;
            return false;
        });

        // 2. Geo-scope projects based on ADMIN'S JURISDICTION (personal location)
        const geoScopedProjects = projects.filter(p => {
            if ([UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole)) return true;
            if (user.currentRole === UserRole.REGIONAL_ADMIN) return p.region === user.region;
            if (user.currentRole === UserRole.COUNTY_ADMIN) return p.county === user.county && p.region === user.region;
            if (user.currentRole === UserRole.SUB_COUNTY_ADMIN) return p.subCounty === user.subCounty && p.county === user.county && p.region === user.region;
            return false;
        });

        // 3. Filter projects relevant to the viewing competition level
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const viewingLevelIndex = levelOrder.indexOf(viewingLevel);
        // A project is relevant if it reached or surpassed the viewing level
        const projectsAtViewingLevel = geoScopedProjects.filter(p => {
            // Exclude unapproved or rejected projects from counts
            if (p.status === ProjectStatus.AWAITING_APPROVAL || p.status === ProjectStatus.REJECTED) return false;

            return levelOrder.indexOf(p.currentLevel) >= viewingLevelIndex || (p.currentLevel === viewingLevel && p.isEliminated);
        });

        // 4. Calculate all stats based on `projectsAtViewingLevel`
        const allJudged = projectsAtViewingLevel.length > 0 && projectsAtViewingLevel.every(p => {
            const scores = calculateProjectScores(p.id, viewingLevel);
            return scores.isFullyJudged && !scores.needsArbitration;
        });

        const activePatronIds = new Set(projectsAtViewingLevel.map(p => p.patronId).filter(Boolean));
        const filteredPatrons = geoScopedUsers.filter(u => u.roles.includes(UserRole.PATRON) && activePatronIds.has(u.id));

        const hasPromotedProjects = nextLevel ? projectsAtViewingLevel.some(p => p.currentLevel === nextLevel) : false;
        const hasEliminatedProjects = projectsAtViewingLevel.some(p => p.currentLevel === viewingLevel && p.isEliminated);
        let resultsPublished = hasPromotedProjects || hasEliminatedProjects;

        if (viewingLevel === CompetitionLevel.NATIONAL && !resultsPublished && projectsAtViewingLevel.length > 0) {
            const projectIdsAtNational = new Set(projectsAtViewingLevel.map(p => p.id));
            const assignmentsForNationalLevel = assignments.filter(a =>
                projectIdsAtNational.has(a.projectId) &&
                // FIX: Corrected property access from 'competition_level' to 'competitionLevel'.
                a.competitionLevel === CompetitionLevel.NATIONAL
            );

            if (assignmentsForNationalLevel.length > 0 && assignmentsForNationalLevel.every(a => a.isArchived)) {
                resultsPublished = true;
            }
        }

        const currentRankingData = calculateRankingsAndPointsForProjects(projectsAtViewingLevel, viewingLevel);

        const ties = [];
        if (isViewingActiveLevel) { // Only check for ties on the active level
            const projectsByCategory = currentRankingData.projectsWithPoints.reduce((acc, p) => {
                if (!acc[p.category]) acc[p.category] = [];
                acc[p.category].push(p);
                return acc;
            }, {} as Record<string, ProjectWithRank[]>);
            for (const category in projectsByCategory) {
                const projectsInThisCategory = projectsByCategory[category];
                const scoresByRank: { [rank: number]: number } = {};
                projectsInThisCategory.forEach(p => { if (p.categoryRank <= 4) scoresByRank[p.categoryRank] = p.totalScore; });
                const distinctScoresInTop4 = new Set(Object.values(scoresByRank));
                const projectsInTop4 = projectsInThisCategory.filter(p => p.categoryRank <= 4);
                if (projectsInTop4.length > distinctScoresInTop4.size) {
                    // There's a tie
                    const projectsByScore = new Map<number, ProjectWithRank[]>();
                    projectsInTop4.forEach(p => {
                        if (!projectsByScore.has(p.totalScore)) projectsByScore.set(p.totalScore, []);
                        projectsByScore.get(p.totalScore)!.push(p);
                    });
                    projectsByScore.forEach((tiedProjects, score) => {
                        if (tiedProjects.length > 1) ties.push({ category, score, projects: tiedProjects });
                    });
                }
            }
        }

        let totalForJudging = projectsAtViewingLevel.length;
        if (totalForJudging === 0) {
            return { projectsAtViewingLevel: [], userStats: { all: 0, admins: 0, judgesInScope: 0, judgesActiveForLevel: 0, patrons: 0 }, areAllProjectsJudged: false, haveResultsBeenPublished: false, rankingData: null, scopedRankingData: { groupedProjects: {}, relevantEntities: [], entityType: '' }, tiesToResolve: [], completionPercentage: 0, projectsInReview: 0, categoryChartData: [], regionChartData: [], barChartTitle: '', activeJudgeIdsForLevel: new Set() };
        }

        const fullyJudgedCount = projectsAtViewingLevel.filter(p => calculateProjectScores(p.id, viewingLevel).isFullyJudged).length;
        const completion = Math.round((fullyJudgedCount / totalForJudging) * 100);

        const reviewCount = projectsAtViewingLevel.filter(p => calculateProjectScores(p.id, viewingLevel).needsArbitration).length;

        const categoryData = projectsAtViewingLevel.reduce((acc, p) => {
            acc[p.category] = (acc[p.category] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        const catChartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

        let propToGroupBy: keyof Project = 'region';
        let title = 'Project Counts by Region';
        switch (user.currentRole) {
            case UserRole.SUB_COUNTY_ADMIN: propToGroupBy = 'zone'; title = `Project Counts by Zone in ${user.subCounty}`; break;
            case UserRole.COUNTY_ADMIN: propToGroupBy = 'subCounty'; title = `Project Counts by Sub-County in ${user.county}`; break;
            case UserRole.REGIONAL_ADMIN: propToGroupBy = 'county'; title = `Project Counts by County in ${user.region}`; break;
        }
        const regionCounts = projectsAtViewingLevel.reduce((acc, p) => {
            const key = p[propToGroupBy] as string;
            if (key) acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        const regChartData = Object.entries(regionCounts).map(([name, projectCount]) => ({ name, projects: projectCount }));

        let relevantEntities: RankedEntity[] = [];
        let entityType = '';
        const { schoolRanking, subCountyRanking, countyRanking, regionRanking } = currentRankingData;
        const scope = {
            region: [UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN].includes(user.currentRole) ? user.region : undefined,
            county: [UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN].includes(user.currentRole) ? user.county : undefined,
            subCounty: user.currentRole === UserRole.SUB_COUNTY_ADMIN ? user.subCounty : undefined,
        };
        if (scope.subCounty) {
            relevantEntities = schoolRanking.filter(s => {
                const schoolInfo = schoolData.find(sd => sd.school === s.name);
                return schoolInfo?.subCounty === scope.subCounty;
            });
            entityType = 'School';
        } else if (scope.county) {
            relevantEntities = subCountyRanking[scope.county] || []; entityType = 'Sub-County';
        } else if (scope.region) {
            relevantEntities = countyRanking[scope.region] || []; entityType = 'County';
        } else {
            relevantEntities = regionRanking; entityType = 'Region';
        }
        const groupedProjects = currentRankingData.projectsWithPoints.reduce((acc, p) => {
            if (!acc[p.category]) acc[p.category] = [];
            acc[p.category].push(p);
            return acc;
        }, {} as { [category: string]: ProjectWithRank[] });

        // --- REVISED LOGIC for user stats ---
        const activeAdminUsers = geoScopedUsers.filter(u => u.roles.some(r => ADMIN_ROLES.includes(r)));
        const judgesInScope = geoScopedUsers.filter(u => u.roles.some(r => JUDGE_ROLES.includes(r)));
        const judgesInScopeIds = new Set(judgesInScope.map(u => u.id));

        // A judge is active if they have a non-archived assignment for the current viewing level within the admin's scope.
        const activeJudgeAssignments = assignments.filter(a =>
            a.competitionLevel === viewingLevel &&
            !a.isArchived &&
            judgesInScopeIds.has(a.judgeId)
        );
        const activeJudgeIdsForLevel = new Set(activeJudgeAssignments.map(a => a.judgeId));

        const allActiveUserIds = new Set([
            ...activeAdminUsers.map(u => u.id),
            ...judgesInScope.map(u => u.id),
            // FIX: Corrected a typo where 'u' was used instead of 'p' in the map function, causing a reference error.
            ...filteredPatrons.map(p => p.id)
        ]);

        const calculatedUserStats = {
            all: allActiveUserIds.size,
            admins: activeAdminUsers.length,
            judgesInScope: judgesInScope.length,
            judgesActiveForLevel: activeJudgeIdsForLevel.size,
            patrons: filteredPatrons.length,
        };

        return {
            projectsAtViewingLevel,
            userStats: calculatedUserStats,
            areAllProjectsJudged: allJudged,
            haveResultsBeenPublished: resultsPublished,
            rankingData: currentRankingData,
            scopedRankingData: { groupedProjects, relevantEntities, entityType },
            tiesToResolve: ties,
            completionPercentage: isNaN(completion) ? 0 : completion,
            projectsInReview: reviewCount,
            categoryChartData: catChartData,
            regionChartData: regChartData,
            barChartTitle: title,
            activeJudgeIdsForLevel,
        };
    }, [user, users, projects, assignments, calculateProjectScores, calculateProjectScoresWithBreakdown, calculateRankingsAndPointsForProjects, viewingLevel, overallHighestLevel, nextLevel, isViewingActiveLevel, isViewingPastLevel, schoolData]);

    // FIX: Implement handleDownloadMarksheetsPDF function.
    const handleDownloadMarksheetsPDF = async () => {
        if (!user || !rankingData) {
            showNotification("No ranking data available to generate marksheets.", "error");
            return;
        }

        setIsDownloading(true);
        // Small timeout to allow UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const doc = new jsPDF({ orientation: 'landscape' });

            const addHeader = (category: string) => {
                const year = new Date().getFullYear();
                const titlePart = `KSEF ${adminLevel} Competitions`.toUpperCase();

                doc.setFontSize(16);
                doc.text("THE KENYA SCIENCE AND ENGINEERING FAIR (KSEF)", 148, 12, { align: 'center' });
                doc.setFontSize(12);
                doc.text(titlePart, 148, 18, { align: 'center' });
                doc.text("RESULTS MARKSHEET", 148, 24, { align: 'center' });
                doc.setFontSize(14);
                doc.text(`CATEGORY: ${category.toUpperCase()}`, 148, 32, { align: 'center' });
            };

            const projectsWithScoresAndBreakdown = rankingData.projectsWithPoints.map(p => {
                const breakdown = calculateProjectScoresWithBreakdown(p.id, viewingLevel);
                return { ...p, ...breakdown };
            });

            const projectsByCategory = projectsWithScoresAndBreakdown.reduce((acc, p) => {
                if (!acc[p.category]) acc[p.category] = [];
                acc[p.category].push(p);
                return acc;
            }, {} as Record<string, typeof projectsWithScoresAndBreakdown>);

            const categories = Object.keys(projectsByCategory).sort();

            if (categories.length === 0) {
                showNotification("No projects with complete scores found to generate marksheets.", "info");
                return;
            }

            categories.forEach((category, index) => {
                if (index > 0) doc.addPage();
                addHeader(category);

                const projectsInCategory = projectsByCategory[category];

                const head = [
                    [
                        { content: 'Project', colSpan: 2, styles: { halign: 'center' } },
                        { content: 'School', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                        { content: 'Presenters', colSpan: 2, styles: { halign: 'center' } },
                        { content: 'Score Averages', colSpan: 3, styles: { halign: 'center' } },
                        { content: 'Total Score', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                        { content: 'Points', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                        { content: 'Rank', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    ],
                    ['Reg. No', 'Title', 'Student 1', 'Student 2', 'Sec A', 'Sec B', 'Sec C']
                ];

                const body = projectsInCategory.map(p => [
                    p.projectRegistrationNumber,
                    p.title,
                    p.school,
                    p.students[0] || '',
                    p.students[1] || '',
                    p.scoreA?.toFixed(2) ?? 'N/A',
                    p.scoreB?.toFixed(2) ?? 'N/A',
                    p.scoreC?.toFixed(2) ?? 'N/A',
                    p.totalScore.toFixed(2),
                    p.points,
                    p.categoryRank
                ]);

                (doc as any).autoTable({
                    startY: 40,
                    head: head,
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
                });
            });

            await saveProfileOrFile(doc, `KSEF_Marksheet_${adminLevel}.pdf`);
        } catch (error) {
            console.error("Download failed:", error);
            showNotification("Download failed. Please try again.", "error");
        } finally {
            setIsDownloading(false);
        }
    };

    // FIX: Implement handleExportRankingsPDF function.
    const handleExportRankingsPDF = async () => {
        if (!user || !scopedRankingData.relevantEntities.length) {
            showNotification("No ranking data available to export.", "error");
            return;
        }

        setIsDownloading(true);
        // Small timeout to allow UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const doc = new jsPDF();
            const year = new Date().getFullYear();
            const titlePart = `KSEF ${adminLevel} Competitions`.toUpperCase();

            doc.setFontSize(16);
            doc.text("THE KENYA SCIENCE AND ENGINEERING FAIR (KSEF)", 105, 12, { align: 'center' });
            doc.setFontSize(12);
            doc.text(titlePart, 105, 18, { align: 'center' });
            doc.setFontSize(14);
            doc.text(`${scopedRankingData.entityType} Rankings`, 105, 26, { align: 'center' });

            const head = [[scopedRankingData.entityType, 'Total Points', 'Rank']];
            const body = scopedRankingData.relevantEntities.map(entity => [entity.name, entity.totalPoints.toFixed(0), entity.rank]);

            (doc as any).autoTable({
                startY: 35,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [0, 52, 89], textColor: 255 },
            });

            await saveProfileOrFile(doc, `KSEF_${adminLevel}_${scopedRankingData.entityType}_Rankings.pdf`);
        } catch (error) {
            console.error("Download failed:", error);
            showNotification("Download failed. Please try again.", "error");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadCertificates = async () => {
        if (!user || !activeEdition) return;

        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const viewingLevelIndex = levelOrder.indexOf(viewingLevel);
        const nextLevel = viewingLevelIndex < levelOrder.length - 1 ? levelOrder[viewingLevelIndex + 1] : null;

        // For national level, we need to handle special certificates for top 3 in each category
        if (viewingLevel === CompetitionLevel.NATIONAL) {
            await generateNationalCertificates();
            return;
        }

        setIsDownloading(true);
        showNotification("Generating certificates... This may take a while.", "info");
        // Small timeout to allow UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        try {

            // For other levels, proceed with normal certificate generation
            if (!nextLevel) return;

            const qualifiedProjects = projectsAtViewingLevel.filter(p => levelOrder.indexOf(p.currentLevel) > viewingLevelIndex);

            if (qualifiedProjects.length === 0) {
                showNotification('No qualified projects found to generate certificates.', 'info');
                return;
            }

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const patronMap: Map<string, User> = new Map(users.filter(u => u.roles.includes(UserRole.PATRON)).map(p => [p.id, p]));

            let isFirstPage = true;

            for (const project of qualifiedProjects) {
                const levelFrom = getLevelQualifiedFrom(project.currentLevel);
                if (!levelFrom) continue;

                // School Certificate
                if (!isFirstPage) doc.addPage();
                await addCertificatePage({
                    doc,
                    name: project.school,
                    type: 'School',
                    school: project.school,
                    levelFrom: viewingLevel, // Use current viewing level for levelFrom
                    levelTo: project.currentLevel,
                    editionName: activeEdition.name,
                    region: project.region,
                    county: project.county,
                    subCounty: project.subCounty
                });
                isFirstPage = false;

                // Patron Certificate
                const patron = patronMap.get(project.patronId || '');
                if (patron) {
                    doc.addPage();
                    await addCertificatePage({
                        doc,
                        name: patron.name,
                        type: 'Patron',
                        projectTitle: project.title,
                        school: project.school,
                        levelFrom: viewingLevel, // Use current viewing level for levelFrom
                        levelTo: project.currentLevel,
                        editionName: activeEdition.name,
                        region: project.region,
                        county: project.county,
                        subCounty: project.subCounty,
                        tscNumber: patron.tscNumber,
                        idNumber: patron.idNumber,
                        category: project.category
                    });
                }

                // Student Certificates
                for (const studentName of project.students) {
                    doc.addPage();
                    await addCertificatePage({
                        doc,
                        name: studentName,
                        type: 'Student',
                        projectTitle: project.title,
                        school: project.school,
                        levelFrom: viewingLevel, // Use current viewing level for levelFrom
                        levelTo: project.currentLevel,
                        editionName: activeEdition.name,
                        region: project.region,
                        county: project.county,
                        subCounty: project.subCounty,
                        category: project.category
                    });
                }
            }

            await saveProfileOrFile(doc, `KSEF_${viewingLevel}_Participant_Certificates.pdf`);
        } catch (error) {
            console.error("Certificate generation failed:", error);
            showNotification("Failed to generate certificates. Please try again.", "error");
        } finally {
            setIsDownloading(false);
        }
    };

    const generateNationalCertificates = async () => {
        if (!activeEdition) return;

        setIsDownloading(true);
        showNotification("Generating national certificates... This may take a while.", "info");
        // Small timeout
        await new Promise(resolve => setTimeout(resolve, 100));

        try {

            // First, get the ranked projects data
            const rankingData = calculateRankingsAndPointsForProjects(projectsAtViewingLevel, CompetitionLevel.NATIONAL);
            const rankedProjects = rankingData.projectsWithPoints;

            // Group projects by category
            const projectsByCategory: Record<string, typeof rankedProjects> = {};

            rankedProjects.forEach(project => {
                if (!projectsByCategory[project.category]) {
                    projectsByCategory[project.category] = [];
                }
                projectsByCategory[project.category].push(project);
            });

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const patronMap: Map<string, User> = new Map(users.filter(u => u.roles.includes(UserRole.PATRON)).map(p => [p.id, p]));

            let isFirstPage = true;

            // Process each category
            for (const [category, categoryProjects] of Object.entries(projectsByCategory)) {
                // Sort projects by their category rank
                const sortedProjects = [...categoryProjects].sort((a, b) => a.categoryRank - b.categoryRank);

                // Process top 3 projects as winners
                const topProjects = sortedProjects.slice(0, 3);

                for (const [index, project] of topProjects.entries()) {
                    const position = index + 1;
                    const levelFrom = CompetitionLevel.REGIONAL; // Assuming they came from regional

                    // School Certificate for Top 3
                    if (!isFirstPage) doc.addPage();
                    await addCertificatePage({
                        doc,
                        name: project.school,
                        type: 'School',
                        school: project.school,
                        levelFrom: CompetitionLevel.NATIONAL,
                        levelTo: CompetitionLevel.NATIONAL,
                        editionName: activeEdition.name,
                        region: project.region,
                        county: project.county,
                        subCounty: project.subCounty,
                        award: `Position ${position} - ${category}`,
                        isWinner: true
                    });
                    isFirstPage = false;

                    // Patron Certificate for Top 3
                    const patron = project.patronId ? patronMap.get(project.patronId) : null;
                    if (patron) {
                        doc.addPage();
                        await addCertificatePage({
                            doc,
                            name: patron.name,
                            type: 'Patron',
                            projectTitle: project.title,
                            school: project.school,
                            levelFrom: CompetitionLevel.NATIONAL,
                            levelTo: CompetitionLevel.NATIONAL,
                            editionName: activeEdition.name,
                            region: project.region,
                            county: project.county,
                            subCounty: project.subCounty,
                            tscNumber: patron.tscNumber,
                            idNumber: patron.idNumber,
                            category: project.category,
                            award: `Position ${position} - ${category}`,
                            isWinner: true
                        });
                    }

                    // Student Certificates for Top 3
                    for (const studentName of project.students) {
                        doc.addPage();
                        await addCertificatePage({
                            doc,
                            name: studentName,
                            type: 'Student',
                            projectTitle: project.title,
                            school: project.school,
                            levelFrom: CompetitionLevel.NATIONAL,
                            levelTo: CompetitionLevel.NATIONAL,
                            editionName: activeEdition.name,
                            region: project.region,
                            county: project.county,
                            subCounty: project.subCounty,
                            category: project.category,
                            award: `Position ${position} - ${category}`,
                            isWinner: true
                        });
                    }
                }

                // Process remaining projects as participants
                const remainingProjects = sortedProjects.slice(3);

                for (const project of remainingProjects) {
                    // School Certificate for Participants
                    doc.addPage();
                    await addCertificatePage({
                        doc,
                        name: project.school,
                        type: 'School',
                        school: project.school,
                        levelFrom: CompetitionLevel.REGIONAL,
                        levelTo: CompetitionLevel.NATIONAL,
                        editionName: activeEdition.name,
                        region: project.region,
                        county: project.county,
                        subCounty: project.subCounty,
                        isParticipant: true
                    });

                    // Patron Certificate for Participants
                    const patron = project.patronId ? patronMap.get(project.patronId) : null;
                    if (patron) {
                        doc.addPage();
                        await addCertificatePage({
                            doc,
                            name: patron.name,
                            type: 'Patron',
                            projectTitle: project.title,
                            school: project.school,
                            levelFrom: CompetitionLevel.REGIONAL,
                            levelTo: CompetitionLevel.NATIONAL,
                            editionName: activeEdition.name,
                            region: project.region,
                            county: project.county,
                            subCounty: project.subCounty,
                            tscNumber: patron.tscNumber,
                            idNumber: patron.idNumber,
                            category: project.category,
                            isParticipant: true
                        });
                    }

                    // Student Certificates for Participants
                    for (const studentName of project.students) {
                        doc.addPage();
                        await addCertificatePage({
                            doc,
                            name: studentName,
                            type: 'Student',
                            projectTitle: project.title,
                            school: project.school,
                            levelFrom: CompetitionLevel.REGIONAL,
                            levelTo: CompetitionLevel.NATIONAL,
                            editionName: activeEdition.name,
                            region: project.region,
                            county: project.county,
                            subCounty: project.subCounty,
                            category: project.category,
                            isParticipant: true
                        });
                    }
                }
            }

            await saveProfileOrFile(doc, `KSEF_NATIONAL_CERTIFICATES_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("National Certificate generation failed:", error);
            showNotification("Failed to generate national certificates. Please try again.", "error");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadJudgeCertificates = async () => {
        if (!user || !activeEdition) return;

        const judgesToCertify = users.filter(u => activeJudgeIdsForLevel.has(u.id));

        if (judgesToCertify.length === 0) {
            showNotification(`No active judges found for the ${viewingLevel} level to generate certificates.`, 'info');
            return;
        }

        setIsDownloading(true);
        showNotification("Generating judge certificates... This may take a while.", "info");
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            for (const [index, judge] of judgesToCertify.entries()) {
                if (index > 0) doc.addPage();

                const judgeAssignments = assignments.filter(a => a.judgeId === judge.id && a.competitionLevel === viewingLevel && !a.isArchived);
                const projectIds = [...new Set(judgeAssignments.map(a => a.projectId))];
                const judgeCategories = [...new Set(projects
                    .filter(p => projectIds.includes(p.id))
                    .map(p => p.category)
                )];

                await addCertificatePage({
                    doc,
                    name: judge.name,
                    type: 'Judge',
                    levelFrom: viewingLevel, // The level they judged
                    editionName: activeEdition.name,
                    region: judge.workRegion || judge.region,
                    county: judge.workCounty || judge.county,
                    subCounty: judge.workSubCounty || judge.subCounty,
                    tscNumber: judge.tscNumber,
                    idNumber: judge.idNumber,
                    category: judgeCategories.join(', '),
                });
            }

            await saveProfileOrFile(doc, `KSEF_${viewingLevel}_Judge_Certificates.pdf`);
        } catch (error) {
            console.error("Judge Certificate generation failed:", error);
            showNotification("Failed to generate judge certificates. Please try again.", "error");
        } finally {
            setIsDownloading(false);
        }
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

    const handlePublish = async () => {
        if (!user) return;
        setPublishMessage(null);
        const result = await publishResults(user);
        if (result.success) {
            setPublishMessage({ type: 'success', text: result.message });
        } else {
            setPublishMessage({ type: 'error', text: result.message });
        }
        setConfirmModalOpen(false);
    };

    const handleUnpublish = async () => {
        if (!user) return;
        setPublishMessage(null);
        const result = await unpublishResults(user);
        if (result.success) {
            setPublishMessage({ type: 'success', text: result.message });
        } else {
            setPublishMessage({ type: 'error', text: result.message });
        }
        setUnpublishConfirmModalOpen(false);
    };

    const handleTieBreakSave = (projectToUpdate: Project, newScoreA: number) => {
        updateProject({ ...projectToUpdate, overrideScoreA: newScoreA });
        setTieBreakState({ isOpen: false, project: null, scores: null });
        showNotification(`Tie resolved for "${projectToUpdate.title}". Scores updated.`, 'success');
    };

    const canPublish = user && [UserRole.SUB_COUNTY_ADMIN, UserRole.COUNTY_ADMIN, UserRole.REGIONAL_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole);
    const canManageThisLevel = canPublish && viewingLevel === adminLevel;
    const publishButtonTitle = isHistoricalView
        ? "Cannot publish results while in historical view mode."
        : !isViewingActiveLevel
            ? "Can only publish results for the currently active competition level."
            : !areAllProjectsJudged
                ? "All projects must be fully judged before publishing"
                : tiesToResolve.length > 0
                    ? "You must resolve all ties before publishing"
                    : "Publish results and promote top projects";

    return (
        <div className="space-y-6">
            <CompetitionLevelSwitcher />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link to="/projects">
                    <DashboardCard title="Total Projects" value={projectsAtViewingLevel.length.toString()} icon={<FileText />} />
                </Link>
                <DashboardCard title="Completed Judging" value={`${completionPercentage}%`} icon={<CheckCircle />} />
                <Link to="/projects?filter=in-review">
                    <DashboardCard title="Projects in Review" value={projectsInReview.toString()} icon={<AlertTriangle />} />
                </Link>
            </div>

            {tiesToResolve.length > 0 && isViewingActiveLevel && !isHistoricalView && (
                <Card className="bg-amber-50 dark:bg-amber-900/30 border border-amber-400">
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                        <AlertTriangle /> Ties to Resolve
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                        The following projects are tied for a top 4 position. Please adjust the Section A score for one or more projects to break the tie before publishing results.
                    </p>
                    <div className="space-y-3">
                        {tiesToResolve.map(({ category, score, projects: tiedProjects }) => (
                            <div key={category + score}>
                                <h4 className="font-semibold text-text-light dark:text-text-dark">{category} - Tied at {score.toFixed(2)} pts</h4>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {tiedProjects.map(p => (
                                        <li key={p.id} className="flex justify-between items-center py-1">
                                            <span>{p.title} ({p.school}) - Rank #{p.categoryRank}</span>
                                            <Button size="sm" variant="secondary" onClick={() => {
                                                const projectScores = calculateProjectScores(p.id, viewingLevel);
                                                setTieBreakState({ isOpen: true, project: p, scores: projectScores });
                                            }} className="flex items-center gap-1"><Edit size={14} /> Resolve</Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Publish Card */}
            {canManageThisLevel && isViewingActiveLevel && !haveResultsBeenPublished && (
                <Card>
                    <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
                        {viewingLevel === CompetitionLevel.NATIONAL ? 'Finalize National Competition' : 'Publish & Promote Projects'}
                    </h3>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                        {viewingLevel === CompetitionLevel.NATIONAL
                            ? `Once all ${projectsAtViewingLevel.length} projects at the National level are fully judged, you can finalize the competition. This will mark the top 4 projects in each category as winners and eliminate the rest. This action is irreversible.`
                            : `Once all ${projectsAtViewingLevel.length} projects at your level are fully judged and all ties are resolved, you can publish the results. This will automatically promote the top 4 projects from each category to the next level. This action is irreversible for the current competition level.`
                        }
                    </p>
                    {publishMessage && (
                        <div className={`p-3 rounded-md mb-4 text-sm flex items-center gap-2 ${publishMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                            {publishMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            {publishMessage.text}
                        </div>
                    )}
                    <Button
                        onClick={() => setConfirmModalOpen(true)}
                        disabled={!areAllProjectsJudged || tiesToResolve.length > 0 || isHistoricalView || !isViewingActiveLevel}
                        title={publishButtonTitle}
                        className="w-full sm:w-auto flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        {viewingLevel === CompetitionLevel.NATIONAL ? 'Finalize National Results' : `Publish ${user?.currentRole.replace(' Admin', '')} Results`}
                    </Button>
                </Card>
            )}

            {/* Unpublish Card */}
            {canManageThisLevel && haveResultsBeenPublished && (
                <Card>
                    <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">Manage Published Results</h3>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                        Results for your level have been published. You can roll back this action as long as judging has not started at the next level.
                    </p>
                    {publishMessage && (
                        <div className={`p-3 rounded-md mb-4 text-sm flex items-center gap-2 ${publishMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                            {publishMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            {publishMessage.text}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadMarksheetsPDF} disabled={isDownloading}>
                            {isDownloading ? 'Processing...' : 'Download Results Marksheets (PDF)'}
                        </Button>
                        {haveResultsBeenPublished && (
                            <Button onClick={handleDownloadCertificates} variant="secondary" disabled={isDownloading}>
                                {isDownloading ? 'Generating...' : 'Generate Certificates (Bulk)'}
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4">
                        {isRollbackPossible && !isHistoricalView && (
                            <Button
                                onClick={() => setUnpublishConfirmModalOpen(true)}
                                title="Roll back results to the previous state."
                                className="w-full sm:w-auto flex items-center gap-2 !bg-amber-500 hover:!bg-amber-600 text-white"
                            >
                                <RotateCcw className="w-4 h-4" /> Unpublish Results
                            </Button>
                        )}
                        <Button
                            onClick={handleDownloadCertificates}
                            disabled={isHistoricalView}
                            title={isHistoricalView ? "Cannot generate certificates in historical view." : "Download certificates for all qualified participants."}
                            className="w-full sm:w-auto flex items-center gap-2"
                            variant="secondary"
                        >
                            <CertificateIcon className="w-4 h-4" /> Download Participant Certificates
                        </Button>
                    </div>
                    {!isRollbackPossible && haveResultsBeenPublished && !isHistoricalView && (
                        <div className="mt-4 p-3 rounded-md text-sm flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <Info className="w-5 h-5 flex-shrink-0" />
                            Rollback is locked because judging has already commenced at the {nextLevel} level.
                        </div>
                    )}
                </Card>
            )}


            <Card>
                <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">User Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Link to="/users?filter=ALL">
                        <DashboardCard title="All Users in Scope" value={userStats.all.toString()} icon={<Users />} />
                    </Link>
                    <Link to="/users?filter=ADMINS">
                        <DashboardCard title="Administrators" value={userStats.admins.toString()} icon={<Shield />} />
                    </Link>
                    <Link to="/users?filter=JUDGES">
                        <DashboardCard
                            title="Judges & Coordinators"
                            icon={<UserCheck />}
                            value={
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <h3 className="text-3xl font-bold text-text-light dark:text-text-dark">{userStats.judgesInScope}</h3>
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">All in Scope</p>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-bold text-primary">{userStats.judgesActiveForLevel}</h3>
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Active for Level</p>
                                    </div>
                                </div>
                            }
                        />
                    </Link>
                    <Link to="/users?filter=PATRONS">
                        <DashboardCard title="Active Patrons" value={userStats.patrons.toString()} icon={<UserCircle />} />
                    </Link>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <LeaderboardCard
                    groupedProjects={scopedRankingData.groupedProjects}
                    relevantEntities={scopedRankingData.relevantEntities}
                    entityType={scopedRankingData.entityType}
                />
                <Card>
                    <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">{barChartTitle}</h3>
                    <RegionBarChart data={regionChartData} />
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                    <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Projects by Category</h3>
                    <CategoryPieChart data={categoryChartData} />
                </Card>
                <Card>
                    <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Reporting & Exports</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button onClick={handleDownloadMarksheetsPDF} variant="secondary" disabled={isDownloading} className="flex items-center justify-center gap-2">
                            {isDownloading ? <Loader2 className="animate-spin" /> : <FileDown />} {isDownloading ? 'Processing...' : 'Download Marksheets (PDF)'}
                        </Button>
                        <Link to="/reporting">
                            <Button variant="secondary" disabled={isDownloading} className="w-full flex items-center justify-center gap-2"><FileText /> Generate Broadsheets (PDF)</Button>
                        </Link>
                        <Button onClick={handleExportRankingsPDF} variant="secondary" disabled={isDownloading} className="w-full flex items-center justify-center gap-2">
                            {isDownloading ? <Loader2 className="animate-spin" /> : <BarChart />} {isDownloading ? 'Processing...' : 'Export School Rankings (PDF)'}
                        </Button>
                        <Button onClick={handleDownloadJudgeCertificates} variant="secondary" disabled={isDownloading} className="w-full flex items-center justify-center gap-2">
                            {isDownloading ? <Loader2 className="animate-spin" /> : <UserCheck />} {isDownloading ? 'Processing...' : 'Download Judge Certificates (PDF)'}
                        </Button>
                    </div>
                </Card>
                <RecentActivityCard notifications={myNotifications} onRead={markAuditLogAsRead} />
            </div>

            {isConfirmModalOpen && (
                <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => setConfirmModalOpen(false)}
                    onConfirm={handlePublish}
                    title={viewingLevel === CompetitionLevel.NATIONAL ? "Finalize National Competition" : "Confirm Publication"}
                    confirmText={viewingLevel === CompetitionLevel.NATIONAL ? "Yes, Finalize" : "Yes, Publish"}
                >
                    {viewingLevel === CompetitionLevel.NATIONAL
                        ? "Are you sure you want to finalize the national competition? This will set the final rankings and winners for this edition."
                        : "Are you sure you want to publish the results? This will finalize scores and promote qualifying projects to the next level. This action cannot be undone for this level."
                    }
                </ConfirmationModal>
            )}

            {isUnpublishConfirmModalOpen && (
                <ConfirmationModal
                    isOpen={isUnpublishConfirmModalOpen}
                    onClose={() => setUnpublishConfirmModalOpen(false)}
                    onConfirm={handleUnpublish}
                    title="Confirm Rollback"
                    confirmText="Yes, Unpublish"
                    confirmVariant="destructive"
                >
                    Are you sure you want to unpublish the results? This will revert all promoted and eliminated projects to their pre-published state, and un-archive their original scores. This can only be done if judging has not started at the next level.
                </ConfirmationModal>
            )}

            {tieBreakState.isOpen && tieBreakState.project && tieBreakState.scores && (
                <TieBreakerModal
                    isOpen={tieBreakState.isOpen}
                    onClose={() => setTieBreakState({ isOpen: false, project: null, scores: null })}
                    project={tieBreakState.project}
                    scores={tieBreakState.scores}
                    onSave={handleTieBreakSave}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
