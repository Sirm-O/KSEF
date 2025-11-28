import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext, JudgingTimerSettings, JudgingHoursSettings } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Bot, Clock, Info, Sun, Moon as MoonIcon } from 'lucide-react';
import { UserRole } from '../types';

const getDeadlineKeyForAdmin = (admin: { currentRole: UserRole, region?: string, county?: string, subCounty?: string }): string => {
    const formatForKy = (str: string | undefined) => str ? str.toLowerCase().replace(/\s+/g, '_') : '';
    switch (admin.currentRole) {
        case UserRole.REGIONAL_ADMIN:
            return `submission_deadline_region_${formatForKy(admin.region)}`;
        case UserRole.COUNTY_ADMIN:
            return `submission_deadline_county_${formatForKy(admin.county)}`;
        case UserRole.SUB_COUNTY_ADMIN:
            return `submission_deadline_subcounty_${formatForKy(admin.subCounty)}`;
        default: // National and Super Admin
            return 'submission_deadline';
    }
};


const SettingsPage: React.FC = () => {
    const { 
        user, 
        roboticsMissions, setRoboticsMissions, 
        allDeadlines, setSubmissionDeadline, 
        applicableTimerSettings, allTimerSettings, setJudgingTimerSettings,
        applicableJudgingHours, allJudgingHours, setJudgingHours
    } = useContext(AppContext);
    
    const [mission1, setMission1] = useState('');
    const [mission2, setMission2] = useState('');
    const [myDeadline, setMyDeadline] = useState('');
    const [timers, setTimers] = useState<JudgingTimerSettings>(applicableTimerSettings);
    // FIX: Renamed useState setter to avoid conflict with context function.
    const [judgingHours, setLocalJudgingHours] = useState<JudgingHoursSettings>(applicableJudgingHours);
    
    const isNationalOrSuperAdmin = useMemo(() => user && [UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole), [user]);

    const { myDeadlineKey, myDeadlineLabel, parentDeadlines } = useMemo(() => {
        if (!user) return { myDeadlineKey: '', myDeadlineLabel: '', parentDeadlines: [] };
        
        const key = getDeadlineKeyForAdmin(user);
        let label = 'National Project Submission Deadline';
        const parents: { label: string; value: string | null }[] = [];

        switch (user.currentRole) {
            case UserRole.REGIONAL_ADMIN:
                label = `Deadline for ${user.region} Region`;
                parents.push({ label: 'National Deadline', value: allDeadlines['submission_deadline'] || null });
                break;
            case UserRole.COUNTY_ADMIN:
                label = `Deadline for ${user.county} County`;
                 const regionKey = `submission_deadline_region_${user.region?.toLowerCase().replace(/\s+/g, '_')}`;
                parents.push({ label: 'National Deadline', value: allDeadlines['submission_deadline'] || null });
                parents.push({ label: `${user.region} Regional Deadline`, value: allDeadlines[regionKey] || null });
                break;
            case UserRole.SUB_COUNTY_ADMIN:
                label = `Deadline for ${user.subCounty} Sub-County`;
                const regionKey2 = `submission_deadline_region_${user.region?.toLowerCase().replace(/\s+/g, '_')}`;
                const countyKey = `submission_deadline_county_${user.county?.toLowerCase().replace(/\s+/g, '_')}`;
                parents.push({ label: 'National Deadline', value: allDeadlines['submission_deadline'] || null });
                parents.push({ label: `${user.region} Regional Deadline`, value: allDeadlines[regionKey2] || null });
                parents.push({ label: `${user.county} County Deadline`, value: allDeadlines[countyKey] || null });
                break;
        }
        
        return { myDeadlineKey: key, myDeadlineLabel: label, parentDeadlines: parents };

    }, [user, allDeadlines]);

    const getScopeKey = (type: 'region' | 'county' | 'subCounty', value: string | undefined) => {
        if (!value) return '';
        const formatted = value.toLowerCase().replace(/\s+/g, '_');
        return `_${type}_${formatted}`;
    };

    const parentTimerSettings = useMemo(() => {
        if (!user) return [];
        const getSettings = (scopeKey: string) => allTimerSettings[scopeKey] || null;
        const parents: { label: string; settings: Partial<JudgingTimerSettings> | null }[] = [];

        if (user.currentRole === UserRole.SUB_COUNTY_ADMIN) {
             parents.push({ label: `${user.county} County`, settings: getSettings(`_county_${user.county?.toLowerCase().replace(/\s+/g, '_')}`) });
        }
        if ([UserRole.SUB_COUNTY_ADMIN, UserRole.COUNTY_ADMIN].includes(user.currentRole)) {
            parents.push({ label: `${user.region} Regional`, settings: getSettings(`_region_${user.region?.toLowerCase().replace(/\s+/g, '_')}`) });
        }
        if ([UserRole.SUB_COUNTY_ADMIN, UserRole.COUNTY_ADMIN, UserRole.REGIONAL_ADMIN].includes(user.currentRole)) {
            parents.push({ label: 'National', settings: getSettings('') });
        }
        
        return parents.filter(p => p.settings && Object.keys(p.settings).length > 0);
    }, [user, allTimerSettings]);

    const parentJudgingHours = useMemo(() => {
        if (!user) return [];
        const getSettings = (scopeKey: string) => allJudgingHours[scopeKey] || null;
        const parents: { label: string; settings: Partial<JudgingHoursSettings> | null }[] = [];

        if (user.currentRole === UserRole.SUB_COUNTY_ADMIN) {
            parents.push({ label: `${user.county} County`, settings: getSettings(`_county_${user.county?.toLowerCase().replace(/\s+/g, '_')}`) });
        }
        if ([UserRole.SUB_COUNTY_ADMIN, UserRole.COUNTY_ADMIN].includes(user.currentRole)) {
            parents.push({ label: `${user.region} Regional`, settings: getSettings(`_region_${user.region?.toLowerCase().replace(/\s+/g, '_')}`) });
        }
        if ([UserRole.SUB_COUNTY_ADMIN, UserRole.COUNTY_ADMIN, UserRole.REGIONAL_ADMIN].includes(user.currentRole)) {
            parents.push({ label: 'National', settings: getSettings('') });
        }
        
        return parents.filter(p => p.settings && Object.keys(p.settings).length > 0);
    }, [user, allJudgingHours]);


    useEffect(() => {
        setMission1(roboticsMissions.mission1);
        setMission2(roboticsMissions.mission2);
        setTimers(applicableTimerSettings);
        // FIX: Use renamed useState setter.
        setLocalJudgingHours(applicableJudgingHours);
        
        const deadlineValue = allDeadlines[myDeadlineKey];
        if (deadlineValue) {
            const date = new Date(deadlineValue);
            const timezoneOffset = date.getTimezoneOffset() * 60000;
            const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
            setMyDeadline(localISOTime);
        } else {
            setMyDeadline('');
        }
    }, [roboticsMissions, allDeadlines, myDeadlineKey, applicableTimerSettings, applicableJudgingHours]);

    const handleSaveMissions = () => {
        setRoboticsMissions({ mission1, mission2 });
    };

    const handleDeadlineSave = () => {
        if (myDeadline) {
            const date = new Date(myDeadline);
            setSubmissionDeadline(date.toISOString());
        } else {
            setSubmissionDeadline(null);
        }
    };

    const handleTimerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTimers(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };
    
    const handleSaveTimers = () => {
        setJudgingTimerSettings(timers);
    };

    const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // FIX: Use renamed useState setter.
        setLocalJudgingHours(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSaveHours = () => {
        // FIX: Pass the local state `judgingHours` to the context function.
        setJudgingHours(judgingHours);
    };


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Application Settings</h1>

            <Card>
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-2 flex items-center gap-2">
                    <Clock /> Project Submission Deadline
                </h2>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                    Set the final deadline for your jurisdiction. This will override any deadline set by a higher administrative level for users and projects within your scope.
                </p>

                {parentDeadlines.length > 0 && (
                    <div className="mb-4 p-3 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-r-lg space-y-1">
                        <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">For Your Information:</p>
                        {parentDeadlines.map(pd => (
                             <p key={pd.label} className="text-sm text-blue-700 dark:text-blue-400">
                                The current {pd.label} is: <span className="font-medium">{pd.value ? new Date(pd.value).toLocaleString() : 'Not Set'}</span>
                            </p>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-grow">
                        <label htmlFor="deadline-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{myDeadlineLabel}</label>
                        <input
                            id="deadline-input"
                            type="datetime-local"
                            value={myDeadline}
                            onChange={(e) => setMyDeadline(e.target.value)}
                            className="p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                    <Button onClick={handleDeadlineSave} className="self-end">Save Deadline</Button>
                </div>
                {allDeadlines[myDeadlineKey] ? 
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">Your current deadline is set to: {new Date(allDeadlines[myDeadlineKey]).toLocaleString()}</p>
                    : <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">You have not set a specific deadline. The inherited deadline will be used.</p>
                }
            </Card>

             <Card>
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-2 flex items-center gap-2">
                    <Sun className="w-5 h-5" /> Active Judging Hours
                </h2>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                    Define the daily time window during which judges can start new sessions and submit scores. This applies to your jurisdiction and can override higher-level settings.
                </p>

                {parentJudgingHours.length > 0 && (
                     <div className="mb-4 p-3 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-r-lg space-y-2">
                        <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Inherited Judging Hours:</p>
                        {parentJudgingHours.map(p => (
                            <div key={p.label}>
                                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">{p.label} Settings</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    {p.settings?.startTime ?? 'N/A'} - {p.settings?.endTime ?? 'N/A'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="grid grid-cols-2 gap-4 flex-grow">
                         <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Time</label>
                            <input type="time" id="startTime" name="startTime" value={judgingHours.startTime} onChange={handleHoursChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600"/>
                        </div>
                        <div>
                            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Time</label>
                            <input type="time" id="endTime" name="endTime" value={judgingHours.endTime} onChange={handleHoursChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600"/>
                        </div>
                    </div>
                    <Button onClick={handleSaveHours} className="self-end">Save Judging Hours</Button>
                </div>
                 <p className="mt-2 text-sm text-green-600 dark:text-green-400">Active judging hours for your jurisdiction are from {applicableJudgingHours.startTime} to {applicableJudgingHours.endTime}.</p>
            </Card>

            <Card>
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-2 flex items-center gap-2">
                    <Clock /> Judging Timers (in minutes)
                </h2>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                    Set minimum and maximum judging times for your jurisdiction to ensure quality and prevent abuse. If a judge exceeds the maximum time, the project is automatically sent for review.
                </p>

                {parentTimerSettings.length > 0 && (
                    <div className="mb-4 p-3 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-r-lg space-y-2">
                        <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Inherited Timer Settings:</p>
                        {parentTimerSettings.map(p => (
                            <div key={p.label}>
                                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">{p.label} Settings</p>
                                <div className="text-xs text-blue-600 dark:text-blue-400 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                    <span>Part A: Min {p.settings?.minTimeA ?? 'N/A'}m, Max {p.settings?.maxTimeA ?? 'N/A'}m</span>
                                    <span>Part B&C: Min {p.settings?.minTimeBC ?? 'N/A'}m, Max {p.settings?.maxTimeBC ?? 'N/A'}m</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <fieldset className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 border rounded-lg dark:border-gray-600">
                            <h3 className="font-semibold mb-2">Part A: Written Communication</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="minTimeA" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Minimum Time</label>
                                    <input type="number" id="minTimeA" name="minTimeA" value={timers.minTimeA} onChange={handleTimerChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600"/>
                                </div>
                                <div>
                                    <label htmlFor="maxTimeA" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Maximum Time</label>
                                    <input type="number" id="maxTimeA" name="maxTimeA" value={timers.maxTimeA} onChange={handleTimerChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600"/>
                                </div>
                            </div>
                        </div>
                         <div className="p-4 border rounded-lg dark:border-gray-600">
                            <h3 className="font-semibold mb-2">Part B & C: Oral & Scientific</h3>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="minTimeBC" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Minimum Time</label>
                                    <input type="number" id="minTimeBC" name="minTimeBC" value={timers.minTimeBC} onChange={handleTimerChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600"/>
                                </div>
                                <div>
                                    <label htmlFor="maxTimeBC" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Maximum Time</label>
                                    <input type="number" id="maxTimeBC" name="maxTimeBC" value={timers.maxTimeBC} onChange={handleTimerChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </fieldset>
                <div className="mt-4 text-right">
                    <Button onClick={handleSaveTimers}>Save Timer Settings</Button>
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-2 flex items-center gap-2">
                    <Bot /> Robotics Mission Settings
                </h2>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
                    Define the two compulsory missions for the Robotics category for this year's competition. These will appear on all robotics judging sheets.
                </p>

                {!isNationalOrSuperAdmin && (
                    <div className="p-3 mb-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 flex items-center gap-3">
                        <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            This is a national-level setting and cannot be edited by regional, county, or sub-county administrators.
                        </p>
                    </div>
                )}

                <fieldset disabled={!isNationalOrSuperAdmin} className="space-y-4 disabled:opacity-70">
                    <div>
                        <label htmlFor="mission1" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Compulsory Mission 1</label>
                        <textarea 
                            id="mission1" 
                            rows={2} 
                            value={mission1} 
                            onChange={e => setMission1(e.target.value)} 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-dark focus:ring-primary-dark sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label htmlFor="mission2" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Compulsory Mission 2</label>
                        <textarea 
                            id="mission2" 
                            rows={2} 
                            value={mission2} 
                            onChange={e => setMission2(e.target.value)} 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-dark focus:ring-primary-dark sm:text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark dark:border-gray-600 disabled:cursor-not-allowed"
                        />
                    </div>
                </fieldset>
                <div className="mt-4 text-right">
                    {isNationalOrSuperAdmin && <Button onClick={handleSaveMissions}>Save Missions</Button>}
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;
