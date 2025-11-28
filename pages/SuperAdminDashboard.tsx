import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { UserRole, CompetitionLevel } from '../types';
import { Users, KeyRound, ShieldCheck, ClipboardList, Building, Globe, UserCog, School, Map, MapPin, GitBranch, Award, AlertTriangle, CheckCircle } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import { Link } from 'react-router-dom';
import InfoDisplayModal from '../components/ui/InfoDisplayModal';
import GeoHierarchyModal from '../components/admin/GeoHierarchyModal';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN];
const JUDGE_ROLES = [UserRole.JUDGE, UserRole.COORDINATOR];

const SuperAdminDashboard: React.FC = () => {
    const { 
        user, users, projects, schoolData, geographicalData, activeEdition, 
        viewingLevel, calculateProjectScores, completeEdition, showNotification 
    } = useContext(AppContext);

    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState<{ title: string; items: string[] }>({ title: '', items: [] });
    const [isGeoModalOpen, setIsGeoModalOpen] = useState(false);
    const [geoModalStartFrom, setGeoModalStartFrom] = useState<'regions' | 'schools'>('regions');
    const [isCompleteModalOpen, setCompleteModalOpen] = useState(false);


    const stats = useMemo(() => {
        const totalUsers = users.length;
        const totalAdmins = users.filter(u => u.roles.some(r => ADMIN_ROLES.includes(r))).length;
        const totalJudges = users.filter(u => u.roles.some(r => JUDGE_ROLES.includes(r))).length;
        const totalPatrons = users.filter(u => u.roles.includes(UserRole.PATRON)).length;

        const totalProjects = projects.length; // This is now scoped to the active edition
        const totalSchools = schoolData.length; // This is global
        
        const newUsersCount = users.filter(u => !!u.initialPassword).length;
        
        const regionNames = Object.keys(geographicalData).sort();
        
        const zones = new Set<string>();
        Object.values(geographicalData).forEach(region => {
            Object.values(region as object).forEach(county => {
                Object.values(county as object).forEach(zoneList => {
                    (zoneList as string[]).forEach(zone => zones.add(zone));
                });
            });
        });
        schoolData.forEach(school => {
            if (school.zone) zones.add(school.zone);
        });
        
        const schoolNames = [...new Set(schoolData.map(s => s.school))].sort();
        const projectTitles = projects.map(p => p.title).sort();

        return {
            totalUsers,
            totalAdmins,
            totalJudges,
            totalPatrons,
            totalProjects,
            totalSchools,
            newUsersCount,
            regionCount: regionNames.length,
            countyCount: Object.values(geographicalData).reduce<number>((acc, region) => acc + Object.keys(region as object).length, 0),
            subCountyCount: Object.values(geographicalData).reduce<number>((acc, region) => acc + Object.values(region as object).reduce<number>((acc2, county) => acc2 + Object.keys(county as object).length, 0), 0),
            zoneCount: zones.size,
            schoolNames,
            projectTitles,
        };
    }, [users, projects, schoolData, geographicalData]);

    const canCompleteEdition = useMemo(() => {
        const nationalProjects = projects.filter(p => p.currentLevel === CompetitionLevel.NATIONAL && !p.isEliminated);
        const areAllNationalProjectsJudged = nationalProjects.length > 0 && nationalProjects.every(p => calculateProjectScores(p.id, CompetitionLevel.NATIONAL).isFullyJudged);
        
        return user?.currentRole === UserRole.SUPER_ADMIN &&
               viewingLevel === CompetitionLevel.NATIONAL &&
               areAllNationalProjectsJudged &&
               !!activeEdition;
    }, [user, projects, calculateProjectScores, viewingLevel, activeEdition]);

    const handleCompleteEdition = async () => {
        const { success, message } = await completeEdition();
        showNotification(message, success ? 'success' : 'error');
        setCompleteModalOpen(false);
    };

    const handleOpenInfoModal = (title: string, items: string[]) => {
        setInfoModalContent({ title, items });
        setIsInfoModalOpen(true);
    };

    const clickableCardClasses = "hover:ring-2 hover:ring-primary hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer";

    return (
        <div className="space-y-6">
            <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl shadow-lg">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <ShieldCheck className="w-12 h-12 text-primary" />
                        <div>
                            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Super Administrator Panel</h1>
                            <p className="text-text-muted-light dark:text-text-muted-dark mt-1">
                                Platform-wide overview and management tools.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <CompetitionLevelSwitcher />

            {!activeEdition ? (
                <Card className="bg-amber-50 dark:bg-amber-900/30 border border-amber-400">
                    <div className="flex items-center gap-4">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                        <div>
                            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">No Active Edition</h3>
                            <p className="text-amber-700 dark:text-amber-400">
                                The previous edition has been completed. Please go to the <Link to="/editions" className="font-bold underline">Edition Manager</Link> to activate the next one.
                            </p>
                        </div>
                    </div>
                </Card>
            ) : (
                viewingLevel === CompetitionLevel.NATIONAL && (
                    <Card>
                        <h2 className="text-2xl font-bold text-secondary dark:text-accent-green mb-2 flex items-center gap-2">
                            <Award /> Competition Finals
                        </h2>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                            Once all projects at the National Level have been judged, you can finalize the competition. This will deactivate the current edition and activate the next one if available.
                        </p>
                        <Button
                            onClick={() => setCompleteModalOpen(true)}
                            disabled={!canCompleteEdition}
                            title={!canCompleteEdition ? 'All national projects must be fully judged before finalizing the edition.' : 'Finalize the competition'}
                            className="w-full sm:w-auto flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" /> Finalize Edition
                        </Button>
                    </Card>
                )
            )}

            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark pt-4">User Overview (Global)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link to="/users?filter=ALL">
                    <DashboardCard title="Total Users" value={stats.totalUsers.toLocaleString()} icon={<Users />} className={clickableCardClasses} />
                </Link>
                <Link to="/users?filter=ADMINS">
                    <DashboardCard title="Administrators" value={stats.totalAdmins.toLocaleString()} icon={<ShieldCheck />} className={clickableCardClasses} />
                </Link>
                <Link to="/users?filter=JUDGES">
                    <DashboardCard title="Judges & Coordinators" value={stats.totalJudges.toLocaleString()} icon={<UserCog />} className={clickableCardClasses} />
                </Link>
                <Link to="/users?filter=PATRONS">
                    <DashboardCard title="Patrons" value={stats.totalPatrons.toLocaleString()} icon={<School />} className={clickableCardClasses} />
                </Link>
            </div>

            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark pt-4">Active Edition Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DashboardCard 
                    title="Total Projects Registered" 
                    value={activeEdition ? stats.totalProjects.toLocaleString() : '0'} 
                    icon={<ClipboardList />}
                    onClick={() => handleOpenInfoModal(`Projects in ${activeEdition?.name}`, stats.projectTitles)}
                    className={clickableCardClasses}
                />
                <Link to="/initial-passwords">
                    <DashboardCard 
                        title="New User Credentials" 
                        value={stats.newUsersCount.toLocaleString()} 
                        icon={<KeyRound />} 
                        change="View temporary passwords"
                        changeType="increase"
                        className={clickableCardClasses}
                    />
                </Link>
            </div>
            
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark pt-4">Geographical Scope (Global)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <DashboardCard title="Regions" value={stats.regionCount.toLocaleString()} icon={<Globe />} onClick={() => { setGeoModalStartFrom('regions'); setIsGeoModalOpen(true); }} className={clickableCardClasses} />
                <DashboardCard title="Counties" value={stats.countyCount.toLocaleString()} icon={<Map />} onClick={() => { setGeoModalStartFrom('regions'); setIsGeoModalOpen(true); }} className={clickableCardClasses} />
                <DashboardCard title="Sub-Counties" value={stats.subCountyCount.toLocaleString()} icon={<Building />} onClick={() => { setGeoModalStartFrom('regions'); setIsGeoModalOpen(true); }} className={clickableCardClasses} />
                <DashboardCard title="Zones" value={stats.zoneCount.toLocaleString()} icon={<MapPin />} onClick={() => { setGeoModalStartFrom('regions'); setIsGeoModalOpen(true); }} className={clickableCardClasses} />
                <DashboardCard title="Schools" value={stats.totalSchools.toLocaleString()} icon={<School />} onClick={() => { setGeoModalStartFrom('schools'); setIsGeoModalOpen(true); }} className={clickableCardClasses} />
            </div>

            <InfoDisplayModal 
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                title={infoModalContent.title}
                items={infoModalContent.items}
            />
            
            <GeoHierarchyModal
                isOpen={isGeoModalOpen}
                onClose={() => setIsGeoModalOpen(false)}
                startFrom={geoModalStartFrom}
            />

            {isCompleteModalOpen && (
                <ConfirmationModal
                    isOpen={isCompleteModalOpen}
                    onClose={() => setCompleteModalOpen(false)}
                    onConfirm={handleCompleteEdition}
                    title="Finalize Edition?"
                    confirmText="Finalize Edition"
                    confirmVariant="destructive"
                >
                    Are you sure you want to finalize the edition? This action will deactivate the current edition and activate the next edition if it exists. Otherwise, you will need to create and activate the next edition to continue.
                </ConfirmationModal>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
