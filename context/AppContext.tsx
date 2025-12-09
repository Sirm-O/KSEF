import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, Project, JudgeAssignment, ProjectStatus, SchoolLocation, UserRole, RankingData, CompetitionLevel, AuditLog, JudgingDetails, CategoryStats, ProjectWithRank, RankedEntity, Edition } from '../types';
import { KENYAN_GEOGRAPHICAL_DATA, SCORE_SHEET, ROBOTICS_SCORE_SHEET } from '../constants';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import { AuthChangeEvent, Session, createClient } from '@supabase/supabase-js';
import emailjs from '@emailjs/browser';
import { GoogleGenAI } from '@google/genai';

// --- NEW HELPER ---
const generateRandomPassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    // Use crypto for better randomness if available
    if (window.crypto && window.crypto.getRandomValues) {
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            password += charset[values[i] % charset.length];
        }
    } else { // Fallback for older environments
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
    }
    return password;
};

// FIX: Add toTitleCase helper function.
const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};


// --- NEW TYPE ---
// This was missing from the `types.ts` file but is needed here.
export interface JudgingTimerSettings {
    minTimeA: number;
    maxTimeA: number;
    minTimeBC: number;
    maxTimeBC: number;
}

// --- NEW TYPE ---
export interface JudgingHoursSettings {
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
}

// --- NEW TYPE ---
export interface BulkTaskProgress {
    current: number;
    total: number;
    task: string;
}


interface ActiveJudgingInfo {
    projectId: string;
    sectionId: string;
}

export interface ProjectScores {
    scoreA: number | null;
    scoreBC: number | null;
    totalScore: number;
    isFullyJudged: boolean; // True if 2+ judges completed each section AND no arbitration is pending
    needsArbitration: boolean; // True if score variance exists AND coordinator has NOT yet judged
}

const getPrimaryRole = (roles: UserRole[]): UserRole => {
    const ROLE_HIERARCHY = [
        UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
        UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN, UserRole.COORDINATOR,
        UserRole.JUDGE, UserRole.PATRON
    ];
    for (const role of ROLE_HIERARCHY) {
        if (roles.includes(role)) {
            return role;
        }
    }
    return roles[0] || UserRole.PATRON;
};

// FIX: Add 'info' and 'warning' types for notifications.
export type NotificationType = {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
};

// --- NEW: Centralized Admin Role constant
const ADMIN_ROLES = [
    UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
    UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN
];
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

interface IAppContext {
    user: User | null;
    users: User[];
    theme: 'light' | 'dark';
    projects: Project[];
    assignments: JudgeAssignment[];
    activeJudgingInfo: ActiveJudgingInfo | null;
    schoolData: SchoolLocation[];
    geographicalData: typeof KENYAN_GEOGRAPHICAL_DATA;
    submissionDeadline: string | null; // This will hold the *applicable* deadline for the current user
    allDeadlines: Record<string, string>; // This will hold all deadline settings
    auditLogs: AuditLog[];
    notification: NotificationType | null;
    isLoading: boolean;
    isPerformingBackgroundTask: boolean; // NEW
    bulkTaskProgress: BulkTaskProgress | null; // NEW
    applicableTimerSettings: JudgingTimerSettings; // NEW
    allTimerSettings: Record<string, Partial<JudgingTimerSettings>>; // NEW
    applicableJudgingHours: JudgingHoursSettings; // NEW
    allJudgingHours: Record<string, Partial<JudgingHoursSettings>>; // NEW
    isWithinJudgingHours: boolean; // NEW
    roboticsMissions: { mission1: string, mission2: string }; // NEW
    isRollbackPossible: boolean; // NEW
    isJudgingStarted: boolean; // --- NEW ---
    applicableCertificateDesign: string | null; // --- NEW ---
    isEditionCompleted: boolean; // NEW
    // --- EDITION STATE ---
    editions: Edition[];
    activeEdition: Edition | null;
    viewingEdition: Edition | null;
    isHistoricalView: boolean;
    // --- COMPETITION LEVEL STATE ---
    overallHighestLevel: CompetitionLevel;
    viewingLevel: CompetitionLevel;
    setViewingLevel: React.Dispatch<React.SetStateAction<CompetitionLevel>>;
    setActiveJudgingInfo: React.Dispatch<React.SetStateAction<ActiveJudgingInfo | null>>;
    // FIX: Add 'info' and 'warning' types to showNotification signature.
    showNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
    setSubmissionDeadline: (deadline: string | null) => Promise<void>;
    setJudgingTimerSettings: (settings: JudgingTimerSettings) => Promise<void>; // NEW
    setJudgingHours: (hours: JudgingHoursSettings) => Promise<void>; // NEW
    setRoboticsMissions: (missions: { mission1: string, mission2: string }) => Promise<void>; // NEW
    handleJudgeTimeout: (projectId: string, judgeId: string, section: 'Part A' | 'Part B & C', category: string) => Promise<void>; // NEW
    getTimeLeftInJudgingSession: () => number | null; // NEW
    generateCertificateDesigns: (prompt: string) => Promise<string[]>; // --- NEW ---
    saveCertificateDesign: (designBase64: string) => Promise<void>; // --- NEW ---
    removeCertificateDesign: () => Promise<void>; // --- NEW ---
    login: (identifier: string, password: string) => Promise<{ error: string | null }>;
    logout: () => Promise<void>;
    switchRole: (newRole: UserRole) => Promise<void>;
    toggleTheme: () => void;
    createPatronAccount: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
    changePassword: (userId: string, newPassword: string) => Promise<{ error: string | null }>;
    addProject: (project: Omit<Project, 'id' | 'currentLevel' | 'isEliminated' | 'status'>) => Promise<void>;
    updateProject: (updatedProject: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    startJudging: (projectId: string, assignedSection: 'Part A' | 'Part B & C') => Promise<{ success: boolean; message: string }>; // Modified return type
    updateAssignment: (updatedAssignment: JudgeAssignment) => Promise<void>;
    submitAssignmentScore: (completedAssignment: JudgeAssignment) => Promise<boolean>;
    updateUser: (updatedUser: User) => Promise<void>;
    updateUserInList: (updatedUser: User) => Promise<void>;
    addUserToList: (newUser: Omit<User, 'id'>) => Promise<void>;
    bulkCreateOrUpdateUsers: (usersToCreate: Omit<User, 'id'>[], usersToUpdate: User[]) => Promise<void>;
    deleteUserFromList: (userId: string) => Promise<void>;
    bulkDeleteUsers: (userIds: string[]) => Promise<void>;
    bulkUpdateUserRoles: (userIds: string[], rolesToAdd: UserRole[], rolesToRemove: UserRole[]) => Promise<void>;
    addSchoolData: (newSchool: SchoolLocation) => Promise<void>;
    // --- REFACTORED ASSIGNMENT FUNCTIONS ---
    assignJudgeToSectionForLevel: (judgeId: string, category: string, section: 'Part A' | 'Part B & C', level: CompetitionLevel) => Promise<{ success: boolean; message: string }>;
    unassignJudgeFromSectionForLevel: (judgeId: string, category: string, section: 'Part A' | 'Part B & C', level: CompetitionLevel) => Promise<void>;
    calculateProjectScores: (projectId: string, level: CompetitionLevel) => ProjectScores;
    getProjectJudgingProgress: (projectId: string, level: CompetitionLevel) => { isSectionAComplete: boolean; isSectionBComplete: boolean; percentage: number; statusText: string; };
    calculateProjectScoresWithBreakdown: (projectId: string, level: CompetitionLevel) => {
        scoreA: number | null;
        scoreB: number | null;
        scoreC: number | null;
        totalScore: number;
        isFullyJudged: boolean;
    };
    calculateRankingsAndPoints: () => RankingData;
    calculateRankingsAndPointsForProjects: (projectsToRank: Project[], level: CompetitionLevel) => RankingData; // NEW
    publishResults: (admin: User) => Promise<{ success: boolean; message: string }>;
    unpublishResults: (admin: User) => Promise<{ success: boolean; message: string }>;
    getProjectJudgingDetails: (projectId: string, level: CompetitionLevel) => JudgingDetails[];
    getCategoryStats: (category: string, level: CompetitionLevel) => CategoryStats | null;
    markAuditLogAsRead: (logId: string) => Promise<void>;
    markAllAuditLogsAsRead: () => Promise<void>;
    sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
    updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
    // --- EDITION FUNCTIONS ---
    createEdition: (name: string, year: number) => Promise<void>;
    updateEdition: (editionId: number, name: string, year: number) => Promise<void>;
    deleteEdition: (editionId: number) => Promise<void>;
    switchActiveEdition: (editionId: number) => Promise<void>;
    switchViewingEdition: (editionId: number) => Promise<void>;
    completeEdition: () => Promise<{ success: boolean; message: string }>; // --- NEW ---
}

export const AppContext = createContext<IAppContext>({} as IAppContext);

const mapProfileToUser = (profile: any): User | null => {
    if (!profile) return null;
    return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        roles: profile.roles || [],
        currentRole: profile.current_role,
        initialPassword: profile.initial_password,
        forcePasswordChange: profile.force_password_change,
        school: profile.school,
        coordinatedCategory: profile.coordinated_category,
        tscNumber: profile.tsc_number,
        idNumber: profile.id_number,
        phoneNumber: profile.phone_number,
        region: profile.region,
        county: profile.county,
        subCounty: profile.sub_county,
        zone: profile.zone,
        subjects: profile.subjects,
        workRegion: profile.work_region,
        workCounty: profile.work_county,
        workSubCounty: profile.work_sub_county,
    };
};

const mapUserToProfile = (user: Partial<User>): any => {
    const profile: any = {};
    if (user.name !== undefined) profile.name = user.name;
    if (user.email !== undefined) profile.email = user.email;
    if (user.roles !== undefined) profile.roles = user.roles;
    if (user.currentRole !== undefined) profile.current_role = user.currentRole;
    if (user.initialPassword !== undefined) profile.initial_password = user.initialPassword;
    if (user.forcePasswordChange !== undefined) profile.force_password_change = user.forcePasswordChange;
    if (user.school !== undefined) profile.school = user.school;
    if (user.coordinatedCategory !== undefined) profile.coordinated_category = user.coordinatedCategory;

    // Explicitly map empty strings to null for these fields
    if (user.tscNumber !== undefined) profile.tsc_number = user.tscNumber === '' ? null : user.tscNumber;
    if (user.idNumber !== undefined) profile.id_number = user.idNumber === '' ? null : user.idNumber;
    if (user.phoneNumber !== undefined) profile.phone_number = user.phoneNumber === '' ? null : user.phoneNumber;

    if (user.region !== undefined) profile.region = user.region;
    if (user.county !== undefined) profile.county = user.county;
    if (user.subCounty !== undefined) profile.sub_county = user.subCounty;
    if (user.zone !== undefined) profile.zone = user.zone;
    if (user.subjects !== undefined) profile.subjects = user.subjects;
    if (user.workRegion !== undefined) profile.work_region = user.workRegion;
    if (user.workCounty !== undefined) profile.work_county = user.workCounty;
    if (user.workSubCounty !== undefined) profile.work_sub_county = user.workSubCounty;
    return profile;
};

const mapDbSchoolToApp = (dbSchool: any): SchoolLocation | null => {
    if (!dbSchool) return null;
    return {
        school: dbSchool.school,
        region: dbSchool.region,
        county: dbSchool.county,
        subCounty: dbSchool.sub_county,
        zone: dbSchool.zone,
    };
};

const mapDbToProject = (dbProject: any): Project | null => {
    if (!dbProject) return null;
    return {
        id: dbProject.id,
        title: dbProject.title,
        category: dbProject.category,
        projectRegistrationNumber: dbProject.project_registration_number,
        region: dbProject.region,
        county: dbProject.county,
        subCounty: dbProject.sub_county,
        zone: dbProject.zone,
        school: dbProject.school,
        students: dbProject.students,
        patronId: dbProject.patron_id,
        status: dbProject.status,
        currentLevel: dbProject.current_level,
        isEliminated: dbProject.is_eliminated,
        overrideScoreA: dbProject.override_score_a,
        edition_id: dbProject.edition_id,
        // New fields
        abstract: dbProject.abstract,
        aiAnalysis: dbProject.ai_analysis,
        plagiarismScore: dbProject.plagiarism_score,
        plagiarismDetails: dbProject.plagiarism_details,
        rejectionReason: dbProject.rejection_reason,
    };
};

const mapProjectToDb = (project: Partial<Project>): any => {
    const dbProject: any = {};
    // Handle empty strings for UUIDs by converting to null or undefined (if not present)
    if (project.id !== undefined) dbProject.id = project.id === '' ? null : project.id;
    if (project.title !== undefined) dbProject.title = project.title;
    if (project.category !== undefined) dbProject.category = project.category;
    if (project.projectRegistrationNumber !== undefined) dbProject.project_registration_number = project.projectRegistrationNumber;
    if (project.region !== undefined) dbProject.region = project.region;
    if (project.county !== undefined) dbProject.county = project.county;
    if (project.subCounty !== undefined) dbProject.sub_county = project.subCounty;
    if (project.zone !== undefined) dbProject.zone = project.zone;
    if (project.school !== undefined) dbProject.school = project.school;
    if (project.students !== undefined) dbProject.students = project.students;
    if (project.patronId !== undefined) dbProject.patron_id = project.patronId === '' ? null : project.patronId;
    if (project.status !== undefined) dbProject.status = project.status;
    if (project.currentLevel !== undefined) dbProject.current_level = project.currentLevel;
    if (project.isEliminated !== undefined) dbProject.is_eliminated = project.isEliminated;
    if (project.overrideScoreA !== undefined) dbProject.override_score_a = project.overrideScoreA;
    if (project.edition_id !== undefined) dbProject.edition_id = project.edition_id;
    // New fields
    if (project.abstract !== undefined) dbProject.abstract = project.abstract;
    if (project.aiAnalysis !== undefined) dbProject.ai_analysis = project.aiAnalysis;
    if (project.plagiarismScore !== undefined) dbProject.plagiarism_score = project.plagiarismScore;
    if (project.plagiarismDetails !== undefined) dbProject.plagiarism_details = project.plagiarismDetails;
    if (project.rejectionReason !== undefined) dbProject.rejection_reason = project.rejectionReason;

    return dbProject;
};

const mapDbToAssignment = (dbAssignment: any): JudgeAssignment | null => {
    if (!dbAssignment) return null;
    return {
        projectId: dbAssignment.project_id,
        judgeId: dbAssignment.judge_id,
        assignedSection: dbAssignment.assigned_section,
        status: dbAssignment.status,
        score: dbAssignment.score,
        scoreBreakdown: dbAssignment.score_breakdown,
        comments: dbAssignment.comments,
        recommendations: dbAssignment.recommendations,
        isArchived: dbAssignment.is_archived,
        missionDescriptions: dbAssignment.mission_descriptions,
        edition_id: dbAssignment.edition_id,
        competitionLevel: dbAssignment.competition_level,
    };
};

const mapAssignmentToDb = (assignment: Partial<JudgeAssignment>): any => {
    const dbAssignment: any = {};
    if (assignment.projectId !== undefined) dbAssignment.project_id = assignment.projectId;
    if (assignment.judgeId !== undefined) dbAssignment.judge_id = assignment.judgeId;
    if (assignment.assignedSection !== undefined) dbAssignment.assigned_section = assignment.assignedSection;
    if (assignment.status !== undefined) dbAssignment.status = assignment.status;
    if (assignment.score !== undefined) dbAssignment.score = assignment.score;
    if (assignment.scoreBreakdown !== undefined) dbAssignment.score_breakdown = assignment.scoreBreakdown;
    if (assignment.comments !== undefined) dbAssignment.comments = assignment.comments;
    if (assignment.recommendations !== undefined) dbAssignment.recommendations = assignment.recommendations;
    if (assignment.isArchived !== undefined) dbAssignment.is_archived = assignment.isArchived;
    if (assignment.missionDescriptions !== undefined) dbAssignment.mission_descriptions = assignment.missionDescriptions;
    if (assignment.edition_id !== undefined) dbAssignment.edition_id = assignment.edition_id;
    if (assignment.competitionLevel !== undefined) dbAssignment.competition_level = assignment.competitionLevel;
    return dbAssignment;
};

const getDeadlineKeyForAdmin = (admin: User): string => {
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

const getApplicableDeadline = (scope: { region?: string; county?: string; subCounty?: string }, allDeadlines: Record<string, string>): string | null => {
    const formatForKy = (str: string | undefined) => str ? str.toLowerCase().replace(/\s+/g, '_') : '';
    if (scope.subCounty) {
        const subCountyKey = `submission_deadline_subcounty_${formatForKy(scope.subCounty)}`;
        if (allDeadlines[subCountyKey]) return allDeadlines[subCountyKey];
    }
    if (scope.county) {
        const countyKey = `submission_deadline_county_${formatForKy(scope.county)}`;
        if (allDeadlines[countyKey]) return allDeadlines[countyKey];
    }
    if (scope.region) {
        const regionKey = `submission_deadline_region_${formatForKy(scope.region)}`;
        if (allDeadlines[regionKey]) return allDeadlines[regionKey];
    }
    return allDeadlines['submission_deadline'] || null;
};

const getTimerScopePrefix = (scope: { region?: string; county?: string; subCounty?: string; }): string => {
    const formatForKy = (str: string | undefined) => str ? str.toLowerCase().replace(/\s+/g, '_') : '';
    if (scope.subCounty) return `_subcounty_${formatForKy(scope.subCounty)}`;
    if (scope.county) return `_county_${formatForKy(scope.county)}`;
    if (scope.region) return `_region_${formatForKy(scope.region)}`;
    return ''; // National scope
};

// --- NEW --- Helper to get certificate design key for admin's jurisdiction
const getCertificateDesignKeyForAdmin = (admin: User): string => {
    const formatForKy = (str: string | undefined) => str ? str.toLowerCase().replace(/\s+/g, '_') : '';
    switch (admin.currentRole) {
        case UserRole.REGIONAL_ADMIN:
            return `certificate_design_region_${formatForKy(admin.region)}`;
        case UserRole.COUNTY_ADMIN:
            return `certificate_design_county_${formatForKy(admin.county)}`;
        case UserRole.SUB_COUNTY_ADMIN:
            return `certificate_design_subcounty_${formatForKy(admin.subCounty)}`;
        default: // National and Super Admin
            return 'certificate_design_national';
    }
};

// --- NEW --- Helper to determine which certificate design to apply
const determineApplicableCertificateDesign = (scope: { region?: string; county?: string; subCounty?: string }, allDesigns: Record<string, string>): string | null => {
    const formatForKy = (str: string | undefined) => str ? str.toLowerCase().replace(/\s+/g, '_') : '';
    if (scope.subCounty) {
        const key = `certificate_design_subcounty_${formatForKy(scope.subCounty)}`;
        if (allDesigns[key]) return allDesigns[key];
    }
    if (scope.county) {
        const key = `certificate_design_county_${formatForKy(scope.county)}`;
        if (allDesigns[key]) return allDesigns[key];
    }
    if (scope.region) {
        const key = `certificate_design_region_${formatForKy(scope.region)}`;
        if (allDesigns[key]) return allDesigns[key];
    }
    return allDesigns['certificate_design_national'] || null;
};


const getTimerKeyPrefixForAdmin = (admin: User): string => {
    const scope = { region: admin.region, county: admin.county, subCounty: admin.subCounty };
    switch (admin.currentRole) {
        case UserRole.REGIONAL_ADMIN:
            return getTimerScopePrefix({ region: admin.region });
        case UserRole.COUNTY_ADMIN:
            return getTimerScopePrefix({ region: admin.region, county: admin.county });
        case UserRole.SUB_COUNTY_ADMIN:
            return getTimerScopePrefix({ region: admin.region, county: admin.county, subCounty: admin.subCounty });
        default: // National and Super Admin
            return '';
    }
};

const determineApplicableTimers = (scope: { region?: string; county?: string; subCounty?: string }, allTimers: Record<string, Partial<JudgingTimerSettings>>): JudgingTimerSettings => {
    const defaults: JudgingTimerSettings = { minTimeA: 4, maxTimeA: 7, minTimeBC: 8, maxTimeBC: 15 };

    const nationalKey = '';
    const regionKey = getTimerScopePrefix({ region: scope.region });
    const countyKey = getTimerScopePrefix({ region: scope.region, county: scope.county });
    const subCountyKey = getTimerScopePrefix({ region: scope.region, county: scope.county, subCounty: scope.subCounty });

    const nationalSettings = allTimers[nationalKey] || {};
    const regionalSettings = (scope.region && allTimers[regionKey]) ? allTimers[regionKey] : {};
    const countySettings = (scope.county && allTimers[countyKey]) ? allTimers[countyKey] : {};
    const subCountySettings = (scope.subCounty && allTimers[subCountyKey]) ? allTimers[subCountyKey] : {};

    return {
        ...defaults,
        ...nationalSettings,
        ...regionalSettings,
        ...countySettings,
        ...subCountySettings,
    };
};

const determineApplicableJudgingHours = (scope: { region?: string; county?: string; subCounty?: string }, allHours: Record<string, Partial<JudgingHoursSettings>>): JudgingHoursSettings => {
    const defaults: JudgingHoursSettings = { startTime: '08:00', endTime: '17:00' };

    const nationalKey = '';
    const regionKey = getTimerScopePrefix({ region: scope.region });
    const countyKey = getTimerScopePrefix({ region: scope.region, county: scope.county });
    const subCountyKey = getTimerScopePrefix({ region: scope.region, county: scope.county, subCounty: scope.subCounty });

    const nationalSettings = allHours[nationalKey] || {};
    const regionalSettings = (scope.region && allHours[regionKey]) ? allHours[regionKey] : {};
    const countySettings = (scope.county && allHours[countyKey]) ? allHours[countyKey] : {};
    const subCountySettings = (scope.subCounty && allHours[subCountyKey]) ? allHours[subCountyKey] : {};

    return {
        ...defaults,
        ...nationalSettings,
        ...regionalSettings,
        ...countySettings,
        ...subCountySettings,
    };
};

// --- NEW HELPER: Centralized logic to securely update settings via RPC ---
const updateSetting = async (key: string, value: string | number | boolean | null) => {
    // This RPC function is assumed to exist on the backend. It should be a
    // SECURITY DEFINER function that checks the user's role before upserting.
    const { error } = await supabase.rpc('update_setting', {
        p_key: key,
        p_value: value === null ? null : String(value)
    });
    return { error };
};


// --- NEW HELPER: Centralizes logic to find which assignments to use for final scoring ---
const getFinalAssignmentsForSection = (projectId: string, section: 'Part A' | 'Part B & C', allAssignments: JudgeAssignment[], projects: Project[], level: CompetitionLevel, overallHighestLevel: CompetitionLevel, coordinatorIds: Set<string>): JudgeAssignment[] => {
    // A level's assignments are considered "archived" for scoring purposes if:
    // 1. We are viewing a level that is lower than the competition's current highest active level.
    // 2. OR, we are viewing the highest active level itself, but its results have already been published (indicated by archived assignments for that project).
    let isArchived = level !== overallHighestLevel;
    if (level === overallHighestLevel) {
        const assignmentsForThisProjectAndLevel = allAssignments.filter(a => a.projectId === projectId && a.competitionLevel === level);
        if (assignmentsForThisProjectAndLevel.length > 0 && assignmentsForThisProjectAndLevel.every(a => a.isArchived)) {
            isArchived = true;
        }
    }

    const assignmentsForThisProjectLevel = allAssignments.filter(a =>
        a.projectId === projectId &&
        a.isArchived === isArchived &&
        a.competitionLevel === level
    );

    const regularJudgeAssignments = assignmentsForThisProjectLevel.filter(a =>
        a.assignedSection === section &&
        a.status === ProjectStatus.COMPLETED &&
        !coordinatorIds.has(a.judgeId)
    ).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

    const coordinatorAssignment = assignmentsForThisProjectLevel.find(a =>
        a.assignedSection === section &&
        a.status === ProjectStatus.COMPLETED &&
        coordinatorIds.has(a.judgeId)
    );

    if (regularJudgeAssignments.length >= 2) {
        const judge1 = regularJudgeAssignments[0];
        const judge2 = regularJudgeAssignments[1];
        const score1 = judge1.score ?? 0;
        const score2 = judge2.score ?? 0;

        if (Math.abs(score1 - score2) >= 5 && coordinatorAssignment) {
            const coordScore = coordinatorAssignment.score ?? 0;

            if (coordScore === score1) {
                return [coordinatorAssignment, judge1];
            }
            if (coordScore === score2) {
                return [coordinatorAssignment, judge2];
            }

            const diff1 = Math.abs(coordScore - score1);
            const diff2 = Math.abs(coordScore - score2);

            if (diff1 === diff2) {
                return [judge1, judge2, coordinatorAssignment];
            } else {
                const closerJudge = diff1 < diff2 ? judge1 : judge2;
                return [coordinatorAssignment, closerJudge];
            }
        } else {
            return [judge1, judge2];
        }
    } else if (regularJudgeAssignments.length === 1 && coordinatorAssignment) {
        return [regularJudgeAssignments[0], coordinatorAssignment];
    } else if (regularJudgeAssignments.length === 0 && coordinatorAssignment) {
        return [coordinatorAssignment];
    } else {
        return [];
    }
};

// --- NEW LOGIC: Pre-calculate criteria ID sets for score breakdown ---
const bcCriteria = SCORE_SHEET.find(s => s.id === 'BC')?.criteria || [];
const bCriteriaIds = new Set<number>(bcCriteria.filter(c => c.originalSection === 'B').map(c => c.id));
const cCriteriaIds = new Set<number>(bcCriteria.filter(c => c.originalSection === 'C').map(c => c.id));

const roboticsBCriteria = ROBOTICS_SCORE_SHEET.find(s => s.id === 'B')?.criteria || [];
const roboticsBCriteriaIds = new Set<number>(roboticsBCriteria.map(c => c.id));
const roboticsMissionsSection = ROBOTICS_SCORE_SHEET.find(s => s.id === 'C') as any;
const roboticsMissionsData = roboticsMissionsSection?.roboticsMissions;
// FIX: Explicitly type `new Set()` to `new Set<number>()` to prevent type inference issues.
const roboticsCCriteriaIds = roboticsMissionsData ? new Set<number>([...roboticsMissionsData.compulsory.map((m: any) => m.id), ...roboticsMissionsData.studentGenerated.map((m: any) => m.id)]) : new Set<number>();


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true); // Start as true
    const [isPerformingBackgroundTask, setIsPerformingBackgroundTask] = useState(false); // NEW
    const [bulkTaskProgress, setBulkTaskProgress] = useState<BulkTaskProgress | null>(null); // NEW
    const bulkTaskProgressRef = useRef(bulkTaskProgress); // NEW
    useEffect(() => { // NEW
        bulkTaskProgressRef.current = bulkTaskProgress;
    }, [bulkTaskProgress]);
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
    const [schoolData, setSchoolData] = useState<SchoolLocation[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [geographicalData, setGeographicalData] = useState(KENYAN_GEOGRAPHICAL_DATA); // This can remain static for now
    const [submissionDeadline, setSubmissionDeadlineState] = useState<string | null>(null);
    const [allDeadlines, setAllDeadlines] = useState<Record<string, string>>({});
    const [activeJudgingInfo, setActiveJudgingInfo] = useState<ActiveJudgingInfo | null>(() => {
        const saved = sessionStorage.getItem('activeJudgingInfo');
        return saved ? JSON.parse(saved) : null;
    });
    const [applicableTimerSettings, setApplicableTimerSettings] = useState<JudgingTimerSettings>({
        minTimeA: 4, maxTimeA: 7, minTimeBC: 8, maxTimeBC: 15
    });
    const [allTimerSettings, setAllTimerSettings] = useState<Record<string, Partial<JudgingTimerSettings>>>({});
    const [applicableJudgingHours, setApplicableJudgingHours] = useState<JudgingHoursSettings>({ startTime: '08:00', endTime: '17:00' });
    const [allJudgingHours, setAllJudgingHours] = useState<Record<string, Partial<JudgingHoursSettings>>>({});
    const [isWithinJudgingHours, setIsWithinJudgingHours] = useState(false);
    const [roboticsMissions, setRoboticsMissionsState] = useState({ mission1: '', mission2: '' });

    // --- NEW --- Certificate Design State
    const [allCertificateDesigns, setAllCertificateDesigns] = useState<Record<string, string>>({});
    const [applicableCertificateDesign, setApplicableCertificateDesign] = useState<string | null>(null);
    const [isEditionCompleted, setIsEditionCompleted] = useState<boolean>(false);

    // --- EDITION STATE ---
    const [editions, setEditions] = useState<Edition[]>([]);
    const [activeEdition, setActiveEdition] = useState<Edition | null>(null);
    const [viewingEdition, setViewingEdition] = useState<Edition | null>(null);
    const isHistoricalView = useMemo(() => viewingEdition?.id !== activeEdition?.id, [viewingEdition, activeEdition]);

    // --- COMPETITION LEVEL STATE ---
    const [viewingLevel, setViewingLevel] = useState<CompetitionLevel>(CompetitionLevel.SUB_COUNTY);
    const overallHighestLevel = useMemo(() => {
        if (!projects || projects.length === 0) {
            return CompetitionLevel.SUB_COUNTY;
        }
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        let highestLevelIndex = 0;
        // Find the highest level that has active (not eliminated) projects
        for (const project of projects) {
            if (!project.isEliminated) {
                const projectLevelIndex = levelOrder.indexOf(project.currentLevel);
                if (projectLevelIndex > highestLevelIndex) {
                    highestLevelIndex = projectLevelIndex;
                }
            }
        }
        return levelOrder[highestLevelIndex];
    }, [projects]);

    // --- NEW ---
    const isJudgingStarted = useMemo(() => {
        // Judging has started for the viewing edition if any assignment has been started or completed.
        // The `assignments` state is already scoped to the viewingEdition.
        return assignments.some(a => a.status === ProjectStatus.IN_PROGRESS || a.status === ProjectStatus.COMPLETED);
    }, [assignments]);

    useEffect(() => {
        const roleToLevelMap: { [key in UserRole]?: CompetitionLevel } = {
            [UserRole.SUB_COUNTY_ADMIN]: CompetitionLevel.SUB_COUNTY,
            [UserRole.COUNTY_ADMIN]: CompetitionLevel.COUNTY,
            [UserRole.REGIONAL_ADMIN]: CompetitionLevel.REGIONAL,
            [UserRole.NATIONAL_ADMIN]: CompetitionLevel.NATIONAL,
            [UserRole.SUPER_ADMIN]: CompetitionLevel.NATIONAL,
        };

        if (user && roleToLevelMap[user.currentRole]) {
            // On login or role switch, default an admin's view to their own level
            setViewingLevel(roleToLevelMap[user.currentRole]!);
        } else {
            // Fallback for other roles (Patron, Judge) to the highest active level
            setViewingLevel(overallHighestLevel);
        }
    }, [user, overallHighestLevel]);

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    const [notification, setNotification] = useState<NotificationType | null>(null);
    const notificationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // FIX: Add 'info' and 'warning' types to showNotification implementation.
    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', duration: number = 4000) => {
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
        const newNotification = { id: Date.now(), message, type };
        setNotification(newNotification);
        notificationTimerRef.current = setTimeout(() => {
            setNotification(prev => (prev?.id === newNotification.id ? null : prev));
        }, duration);
    }, []);

    const clearAllAppData = useCallback(() => {
        setUser(null);
        setUsers([]);
        setProjects([]);
        setAssignments([]);
        setSchoolData([]);
        setAuditLogs([]);
        setActiveJudgingInfo(null);
        sessionStorage.removeItem('activeJudgingInfo');
        setSubmissionDeadlineState(null);
        setAllDeadlines({});
        // FIX: Added reset for settings-related state to ensure a clean slate on logout.
        setAllTimerSettings({});
        setApplicableTimerSettings({ minTimeA: 4, maxTimeA: 7, minTimeBC: 8, maxTimeBC: 15 });
        setAllJudgingHours({});
        setApplicableJudgingHours({ startTime: '08:00', endTime: '17:00' });
        setRoboticsMissionsState({ mission1: '', mission2: '' });
        // --- NEW ---
        setEditions([]);
        setActiveEdition(null);
        setViewingEdition(null);
        setAllCertificateDesigns({});
        setApplicableCertificateDesign(null);
    }, []);

    // --- REFACTORED: Now fetches data for a specific edition ---
    const fetchEditionData = useCallback(async (editionToLoad: Edition, currentUserProfile: User) => {
        let projectsData, assignmentsData, auditLogsData;
        let projectsError, assignmentsError, auditLogsError;

        if (editionToLoad) {
            [
                { data: projectsData, error: projectsError },
                { data: assignmentsData, error: assignmentsError },
                { data: auditLogsData, error: auditLogsError },
            ] = await Promise.all([
                supabase.from('projects').select('*').eq('edition_id', editionToLoad.id).order('title', { ascending: true }),
                supabase.from('judge_assignments').select('*').eq('edition_id', editionToLoad.id),
                supabase.from('audit_logs').select('*').eq('edition_id', editionToLoad.id).order('timestamp', { ascending: false }),
            ]);
        } else {
            projectsData = []; assignmentsData = []; auditLogsData = [];
        }

        if (projectsError) showNotification(`Error fetching projects: ${projectsError.message}`, 'error');
        if (assignmentsError) showNotification(`Error fetching assignments: ${assignmentsError.message}`, 'error');
        if (auditLogsError) showNotification(`Error fetching audit logs: ${auditLogsError.message}`, 'error');

        setProjects(projectsData ? projectsData.map(mapDbToProject).filter((p): p is Project => p !== null) : []);
        setAssignments(assignmentsData ? assignmentsData.map(mapDbToAssignment).filter((a): a is JudgeAssignment => a !== null) : []);
        setAuditLogs((auditLogsData as AuditLog[]) || []);

        // Settings are global but applicability might depend on user context which is fine
        // Here we refetch settings just in case, though they are less likely to change
        const { data: settingsData, error: settingsError } = await supabase.from('settings').select('key, value');
        if (settingsError) showNotification(`Error fetching settings: ${settingsError.message}`, 'error');

        if (settingsData) {
            const settingsMap = new Map(settingsData.map(s => [s.key, s.value]));
            const deadlines: Record<string, string> = {};
            settingsData.filter(s => s.key.startsWith('submission_deadline')).forEach(s => {
                deadlines[s.key] = s.value;
            });
            setAllDeadlines(deadlines);

            const applicableDeadline = getApplicableDeadline(currentUserProfile, deadlines);
            setSubmissionDeadlineState(applicableDeadline);

            if (editionToLoad) {
                const completedFlag = settingsMap.get(`edition_completed_${editionToLoad.id}`);
                setIsEditionCompleted(completedFlag === 'true' || completedFlag === true || completedFlag === '1');
            } else {
                setIsEditionCompleted(false);
            }
        }

    }, [showNotification]);


    const fetchAllData = useCallback(async (currentUserProfile: User | null) => {
        if (!currentUserProfile) {
            clearAllAppData();
            return;
        }

        // --- EDITION-AWARE DATA FETCHING ---
        // 1. Fetch editions and global data
        const [
            { data: editionsData, error: editionsError },
            { data: usersData, error: usersError },
            { data: schoolDataData, error: schoolDataError },
            { data: settingsData, error: settingsError },
        ] = await Promise.all([
            supabase.from('editions').select('*').order('year', { ascending: false }),
            supabase.from('profiles').select('*').order('name', { ascending: true }),
            supabase.from('school_locations').select('*'),
            supabase.from('settings').select('key, value'),
        ]);

        if (editionsError) showNotification(`Error fetching editions: ${editionsError.message}`, 'error');
        if (usersError) showNotification(`Error fetching users: ${usersError.message}`, 'error');
        if (schoolDataError) showNotification(`Error fetching school data: ${schoolDataError.message}`, 'error');
        if (settingsError) showNotification(`Error fetching settings: ${settingsError.message}`, 'error');

        const allEditions = (editionsData as Edition[]) || [];
        setEditions(allEditions);
        const currentActiveEdition = allEditions.find(e => e.is_active) || null;
        setActiveEdition(currentActiveEdition);
        setViewingEdition(currentActiveEdition); // Default viewing to active

        setUsers(usersData ? usersData.map(mapProfileToUser).filter((u): u is User => u !== null) : []);
        setSchoolData(schoolDataData ? schoolDataData.map(mapDbSchoolToApp).filter((s): s is SchoolLocation => s !== null) : []);

        if (settingsData) {
            const settingsMap = new Map(settingsData.map(s => [s.key, s.value]));
            const allTimers: Record<string, Partial<JudgingTimerSettings>> = {};
            const dbTimerKeys = {
                minTimeA: 'min_time_a', maxTimeA: 'max_time_a', minTimeBC: 'min_time_bc', maxTimeBC: 'max_time_bc'
            };
            settingsData.forEach(setting => {
                for (const [appKey, dbKey] of Object.entries(dbTimerKeys)) {
                    if (setting.key.startsWith(dbKey)) {
                        const scopeKey = setting.key.substring(dbKey.length);
                        if (!allTimers[scopeKey]) allTimers[scopeKey] = {};
                        allTimers[scopeKey][appKey as keyof JudgingTimerSettings] = parseFloat(setting.value);
                    }
                }
            });
            setAllTimerSettings(allTimers);
            setApplicableTimerSettings(determineApplicableTimers(currentUserProfile, allTimers));

            const allHours: Record<string, Partial<JudgingHoursSettings>> = {};
            const dbHoursKeys = { startTime: 'judging_start_time', endTime: 'judging_end_time' };
            settingsData.forEach(setting => {
                for (const [appKey, dbKey] of Object.entries(dbHoursKeys)) {
                    if (setting.key.startsWith(dbKey)) {
                        const scopeKey = setting.key.substring(dbKey.length);
                        if (!allHours[scopeKey]) allHours[scopeKey] = {};
                        allHours[scopeKey][appKey as keyof JudgingHoursSettings] = setting.value;
                    }
                }
            });
            setAllJudgingHours(allHours);
            setApplicableJudgingHours(determineApplicableJudgingHours(currentUserProfile, allHours));

            setRoboticsMissionsState({
                mission1: String(settingsMap.get('robotics_mission_1') || 'Delivering a white cuboid to the school'),
                mission2: String(settingsMap.get('robotics_mission_2') || 'Delivering a white tank to the residential estate'),
            });
            // --- NEW: Fetch certificate designs ---
            const designs: Record<string, string> = {};
            settingsData.filter(s => s.key.startsWith('certificate_design_')).forEach(s => {
                designs[s.key] = s.value;
            });
            setAllCertificateDesigns(designs);
            setApplicableCertificateDesign(determineApplicableCertificateDesign(currentUserProfile, designs));

            if (currentActiveEdition) {
                const completedFlag = settingsMap.get(`edition_completed_${currentActiveEdition.id}`);
                setIsEditionCompleted(completedFlag === 'true' || completedFlag === true || completedFlag === '1');
            } else {
                setIsEditionCompleted(false);
            }
        }

        // 2. Fetch edition-specific data for the active/viewing edition
        if (currentActiveEdition) {
            await fetchEditionData(currentActiveEdition, currentUserProfile);
        }

    }, [showNotification, clearAllAppData, fetchEditionData]);

    // Main effect for authentication and data loading
    useEffect(() => {
        let authListener: { subscription: { unsubscribe: () => void; }; };

        const handleAuthSession = async (session: Session | null) => {
            setIsLoading(true); // Always start loading when handling a session change
            if (session?.user) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileData) {
                    const userProfile = mapProfileToUser(profileData);

                    if (userProfile) {
                        const isCurrentRoleValid = userProfile.roles.includes(userProfile.currentRole);

                        if (!isCurrentRoleValid) {
                            const primaryRole = getPrimaryRole(userProfile.roles);
                            console.warn(`Data inconsistency found for user ${userProfile.email}. Current role '${userProfile.currentRole}' is no longer valid. Resetting to primary role '${primaryRole}'.`);

                            userProfile.currentRole = primaryRole;

                            supabase
                                .from('profiles')
                                .update({ current_role: primaryRole })
                                .eq('id', userProfile.id)
                                .then(({ error: updateError }) => {
                                    if (updateError) {
                                        console.error(`Failed to self-heal user role for ${userProfile.email}:`, updateError.message);
                                    } else {
                                        console.log(`Successfully self-healed role for user ${userProfile.email}.`);
                                    }
                                });
                        }
                    }

                    setUser(userProfile);
                    await fetchAllData(userProfile);
                } else if (session.user.email === 'super@ksef.com') {
                    // Bootstrap Super Admin if profile not found but email matches
                    const profileToInsert = {
                        id: session.user.id,
                        name: 'Super Admin',
                        email: 'super@ksef.com',
                        roles: [UserRole.SUPER_ADMIN],
                        current_role: UserRole.SUPER_ADMIN,
                    };
                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert(profileToInsert)
                        .select()
                        .single();

                    if (insertError) {
                        showNotification(`Failed to create Super Admin profile: ${insertError.message}`, 'error');
                        setUser(null);
                        clearAllAppData();
                    } else {
                        const userProfile = mapProfileToUser(newProfile);
                        setUser(userProfile);
                        await fetchAllData(userProfile);
                    }
                } else if (profileError && profileError.code === 'PGRST116') {
                    console.warn('Profile not found. This can occur during new user creation and is expected.');
                } else if (profileError) {
                    showNotification(`Error fetching profile: ${profileError.message}`, 'error');
                    setUser(null);
                    clearAllAppData();
                }
            } else {
                // No session user, clear all app data
                setUser(null);
                clearAllAppData();
            }
            setIsLoading(false); // End loading after all operations
        };

        // Initial session check on component mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthSession(session);
        });

        // Listen for auth state changes
        authListener = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session) => {
                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    clearAllAppData();
                    showNotification('You have been logged out.', 'info');
                    setIsLoading(false);
                } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
                    handleAuthSession(session);
                }
            }
        ).data;

        return () => {
            if (authListener) {
                authListener.subscription.unsubscribe();
            }
        };
    }, [showNotification, fetchAllData, clearAllAppData]);

    // --- REAL-TIME SUBSCRIPTION EFFECT ---
    useEffect(() => {
        if (!user) return;

        const handleDatabaseChange = (payload: any) => {
            if (bulkTaskProgressRef.current) {
                console.log('Bulk operation in progress, skipping real-time data refresh.');
                return;
            }
            console.log(`Real-time change on '${payload.table}', event: '${payload.eventType}'. Refreshing data.`);
            // Refetch all data to ensure consistency across the app.
            // A more granular approach could be implemented for performance optimization if needed.
            fetchAllData(user);
        };

        // Subscribe to all relevant table changes in a single channel
        const allTablesChannel = supabase
            .channel('ksef-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleDatabaseChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'editions' }, handleDatabaseChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleDatabaseChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_assignments' }, handleDatabaseChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, handleDatabaseChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, handleDatabaseChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'school_locations' }, handleDatabaseChange)
            .subscribe();

        return () => {
            supabase.removeChannel(allTablesChannel);
        };

    }, [user, fetchAllData]);

    // Persist activeJudgingInfo to sessionStorage
    useEffect(() => {
        if (activeJudgingInfo) {
            sessionStorage.setItem('activeJudgingInfo', JSON.stringify(activeJudgingInfo));
        } else {
            sessionStorage.removeItem('activeJudgingInfo');
        }
    }, [activeJudgingInfo]);

    // --- NEW: Effect to periodically check and update if judging is currently active ---
    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            const [startH, startM] = applicableJudgingHours.startTime.split(':').map(Number);
            const [endH, endM] = applicableJudgingHours.endTime.split(':').map(Number);

            const startTime = new Date(now);
            startTime.setHours(startH, startM, 0, 0);

            const endTime = new Date(now);
            endTime.setHours(endH, endM, 0, 0);

            const isWithin = now >= startTime && now <= endTime;
            setIsWithinJudgingHours(isWithin);
        };

        checkTime(); // Check immediately on load/change
        const intervalId = setInterval(checkTime, 30000); // Check every 30 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [applicableJudgingHours]);


    // --- EDITION MANAGEMENT FUNCTIONS ---
    const createEdition = useCallback(async (name: string, year: number) => {
        if (!user || user.currentRole !== UserRole.SUPER_ADMIN) {
            showNotification('You do not have permission to create editions.', 'error');
            return;
        }
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase.from('editions').insert({ name, year, is_active: false });
            if (error) {
                showNotification(`Error creating edition: ${error.message}`, 'error');
            } else {
                showNotification(`Edition "${name}" created successfully.`, 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const updateEdition = useCallback(async (editionId: number, name: string, year: number) => {
        if (!user || user.currentRole !== UserRole.SUPER_ADMIN) {
            showNotification('You do not have permission to edit editions.', 'error');
            return;
        }
        setIsPerformingBackgroundTask(true);
        try {
            const { count: projectsCount, error: projectsError } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('edition_id', editionId);
            const { count: assignmentsCount, error: assignmentsError } = await supabase.from('judge_assignments').select('*', { count: 'exact', head: true }).eq('edition_id', editionId);

            if (projectsError || assignmentsError) {
                showNotification('Error checking edition data.', 'error');
                return;
            }

            if ((projectsCount ?? 0) > 0 || (assignmentsCount ?? 0) > 0) {
                showNotification('Cannot edit an edition that already has projects or judge assignments.', 'error');
                return;
            }

            const { error } = await supabase.from('editions').update({ name, year }).eq('id', editionId);
            if (error) {
                showNotification(`Error updating edition: ${error.message}`, 'error');
            } else {
                showNotification('Edition updated successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const deleteEdition = useCallback(async (editionId: number) => {
        if (!user || user.currentRole !== UserRole.SUPER_ADMIN) {
            showNotification('You do not have permission to delete editions.', 'error');
            return;
        }
        setIsPerformingBackgroundTask(true);
        try {
            const { count: projectsCount, error: projectsError } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('edition_id', editionId);
            const { count: assignmentsCount, error: assignmentsError } = await supabase.from('judge_assignments').select('*', { count: 'exact', head: true }).eq('edition_id', editionId);

            if (projectsError || assignmentsError) {
                showNotification('Error checking edition data.', 'error');
                return;
            }

            if ((projectsCount ?? 0) > 0 || (assignmentsCount ?? 0) > 0) {
                showNotification('Cannot delete an edition that already has projects or judge assignments.', 'error');
                return;
            }

            const { error } = await supabase.from('editions').delete().eq('id', editionId);
            if (error) {
                showNotification(`Error deleting edition: ${error.message}`, 'error');
            } else {
                showNotification('Edition deleted successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const switchActiveEdition = useCallback(async (editionId: number) => {
        if (!user || user.currentRole !== UserRole.SUPER_ADMIN) {
            showNotification('You do not have permission to change the active edition.', 'error');
            return;
        }
        setIsPerformingBackgroundTask(true);
        try {
            // Deactivate all first
            const { error: deactivateError } = await supabase.from('editions').update({ is_active: false }).neq('id', 0);
            if (deactivateError) {
                showNotification(`Error deactivating previous edition: ${deactivateError.message}`, 'error');
                return;
            }
            // Activate the new one
            const { error: activateError } = await supabase.from('editions').update({ is_active: true }).eq('id', editionId);
            if (activateError) {
                showNotification(`Error activating new edition: ${activateError.message}`, 'error');
            } else {
                showNotification('Active edition switched successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const switchViewingEdition = useCallback(async (editionId: number) => {
        if (!user) return;
        setIsLoading(true); // Use main loader for this as it's a full data refresh
        try {
            const editionToView = editions.find(e => e.id === editionId);
            if (editionToView) {
                setViewingEdition(editionToView);
                await fetchEditionData(editionToView, user);
            }
        } finally {
            setIsLoading(false);
        }
    }, [user, editions, fetchEditionData]);

    // --- NEW: Function to complete the edition ---
    const completeEdition = useCallback(async () => {
        if (!user || ![UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole)) {
            showNotification('You do not have permission to finalize the edition.', 'error');
            return { success: false, message: 'Permission denied.' };
        }
        if (!activeEdition) {
            showNotification('No active edition found to finalize.', 'error');
            return { success: false, message: 'No active edition found.' };
        }

        setIsPerformingBackgroundTask(true);
        try {
            setBulkTaskProgress({ current: 0, total: 2, task: 'Deactivating Current Edition' });
            const { error: deactivateError } = await supabase
                .from('editions')
                .update({ is_active: false })
                .eq('id', activeEdition.id);
            if (deactivateError) {
                showNotification(`Error deactivating current edition: ${deactivateError.message}`, 'error');
                return { success: false, message: 'Failed to deactivate current edition.' };
            }

            // Determine next edition candidate (by year greater than current, otherwise newest non-active)
            const newerCandidates = editions
                .filter(e => !e.is_active && e.id !== activeEdition.id && e.year > activeEdition.year)
                .sort((a, b) => a.year - b.year);
            let nextEdition = newerCandidates[0];
            if (!nextEdition) {
                const others = editions
                    .filter(e => !e.is_active && e.id !== activeEdition.id)
                    .sort((a, b) => b.year - a.year);
                nextEdition = others[0];
            }

            if (nextEdition) {
                setBulkTaskProgress({ current: 1, total: 2, task: 'Activating Next Edition' });
                const { error: activateError } = await supabase
                    .from('editions')
                    .update({ is_active: true })
                    .eq('id', nextEdition.id);
                if (activateError) {
                    showNotification(`Edition finalized, but failed to activate next edition: ${activateError.message}`, 'warning');
                    await fetchAllData(user);
                    return { success: true, message: 'Edition finalized. Please activate the next edition manually in the Edition Manager.' };
                }
                await fetchAllData(user);
                return { success: true, message: `Edition finalized. Activated next edition: ${nextEdition.name} (${nextEdition.year}).` };
            } else {
                await fetchAllData(user);
                return { success: true, message: 'Edition finalized. No next edition found. Please create and activate the next edition.' };
            }
        } finally {
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
    }, [user, activeEdition, editions, showNotification, fetchAllData]);

    const login = async (identifier: string, password: string) => {
        // Detect if identifier is an email or phone number
        const isEmail = identifier.includes('@');

        let emailToUse = identifier;

        // If it's a phone number, lookup the associated email
        if (!isEmail) {
            // Normalize phone number to match database format (0XXXXXXXXX)
            let normalizedPhone = identifier.trim().replace(/[\s\-()]/g, ''); // Remove spaces, dashes, parentheses

            // Handle international format: +254XXXXXXXXX -> 0XXXXXXXXX
            if (normalizedPhone.startsWith('+254')) {
                normalizedPhone = '0' + normalizedPhone.substring(4);
            } else if (normalizedPhone.startsWith('254')) {
                normalizedPhone = '0' + normalizedPhone.substring(3);
            }

            // Validate format (should be 10 digits starting with 0)
            if (!/^0\d{9}$/.test(normalizedPhone)) {
                return { error: 'Invalid phone number format. Please use format: 0XXXXXXXXX (10 digits starting with 0)' };
            }

            // Query the profiles table to find user by phone number
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('phone_number', normalizedPhone)
                .single();

            if (profileError || !profileData) {
                return { error: 'Phone number not found. Please check and try again.' };
            }

            emailToUse = profileData.email;
        }

        // Authenticate using email
        const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });
        return { error: error ? error.message : null };
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) showNotification(`Logout failed: ${error.message}`, 'error');
    };

    const switchRole = async (newRole: UserRole) => {
        if (!user || !user.roles.includes(newRole)) {
            showNotification('Invalid role switch attempted.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ current_role: newRole })
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                showNotification(`Role switch failed: ${error.message}`, 'error');
            } else {
                // Re-fetch all data to ensure context is updated correctly for the new role
                const updatedUserProfile = mapProfileToUser(data);
                setUser(updatedUserProfile);
                await fetchAllData(updatedUserProfile);
                showNotification(`Switched to ${newRole} role.`, 'success');
            }
        } finally {
            setIsLoading(false); // isLoading will be set to false inside fetchAllData anyway
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const createPatronAccount = async (name: string, email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: toTitleCase(name),
                    roles: [UserRole.PATRON],
                    current_role: UserRole.PATRON,
                }
            }
        });
        if (error) return { error: error.message };
        if (!data.user) return { error: 'User registration failed, please try again.' };

        const profileToUpsert = {
            id: data.user.id,
            name: toTitleCase(name),
            email: data.user.email,
            roles: [UserRole.PATRON],
            current_role: UserRole.PATRON,
        };

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profileToUpsert, { onConflict: 'id' });

        if (profileError) {
            // We can't delete the auth user here as this is a client-side function without admin rights.
            // Log the error for debugging. The user might need to contact support.
            console.error("CRITICAL: Auth user created but profile upsert failed:", profileError);
            return { error: `Account created, but failed to initialize profile. Please contact support. Error: ${profileError.message}` };
        }

        return { error: null };
    };

    const changePassword = async (userId: string, newPassword: string) => {
        // First, update the auth user's password
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });

        if (authError) {
            return { error: authError.message };
        }

        // After successful password change, update the profile to turn off forcePasswordChange
        const { data: profileUpdateData, error: profileError } = await supabase
            .from('profiles')
            .update({ force_password_change: false, initial_password: null })
            .eq('id', userId)
            .select()
            .single();

        if (profileError) {
            showNotification(`Password updated, but failed to update profile status: ${profileError.message}`, 'warning');
            // To prevent the user from being stuck, we'll optimistically update the local state for this session.
            // If the DB update failed, they'll be redirected here again on their next login.
            if (user) {
                setUser({ ...user, forcePasswordChange: false, initialPassword: undefined });
            }
        } else if (profileUpdateData) {
            // The DB update was successful. Update the local user state with the fresh data from the DB.
            // This will trigger the re-render in App.tsx and navigate the user away from the password change page.
            const updatedUserProfile = mapProfileToUser(profileUpdateData);
            setUser(updatedUserProfile);
        }

        return { error: null };
    };

    const addProject = async (project: Omit<Project, 'id' | 'currentLevel' | 'isEliminated'>) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const newProject = {
                ...project,
                status: project.status || ProjectStatus.AWAITING_APPROVAL,
                currentLevel: CompetitionLevel.SUB_COUNTY,
                isEliminated: false,
            };
            const { error } = await supabase.from('projects').insert(mapProjectToDb(newProject));
            if (error) {
                showNotification(`Error creating project: ${error.message}`, 'error');
            } else {
                showNotification('Project created successfully!', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const updateProject = async (updatedProject: Project) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase.from('projects').update(mapProjectToDb(updatedProject)).eq('id', updatedProject.id);
            if (error) {
                showNotification(`Error updating project: ${error.message}`, 'error');
            } else {
                showNotification('Project updated successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const deleteProject = async (projectId: string) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            // Also delete related assignments
            const { error: assignmentError } = await supabase.from('judge_assignments').delete().eq('project_id', projectId);
            if (assignmentError) {
                showNotification(`Error deleting project assignments: ${assignmentError.message}`, 'error');
                return;
            }

            const { error } = await supabase.from('projects').delete().eq('id', projectId);
            if (error) {
                showNotification(`Error deleting project: ${error.message}`, 'error');
            } else {
                showNotification('Project deleted successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const startJudging = async (projectId: string, assignedSection: 'Part A' | 'Part B & C') => {
        if (!user) return { success: false, message: 'User not found' };

        if (!isWithinJudgingHours) {
            showNotification('Judging is currently closed. You cannot start a new session.', 'error');
            return { success: false, message: 'Judging is closed.' };
        }

        setActiveJudgingInfo({ projectId, sectionId: assignedSection });

        const { error } = await supabase
            .from('judge_assignments')
            .update({ status: ProjectStatus.IN_PROGRESS })
            .eq('project_id', projectId)
            .eq('judge_id', user.id)
            .eq('assigned_section', assignedSection);

        if (error) {
            showNotification(`Failed to update judging status: ${error.message}`, 'error');
            setActiveJudgingInfo(null);
            return { success: false, message: 'Failed to start session.' };
        }

        return { success: true, message: 'Session started.' };
    };

    const updateAssignment = async (updatedAssignment: JudgeAssignment) => {
        const { error } = await supabase
            .from('judge_assignments')
            .update(mapAssignmentToDb(updatedAssignment))
            .eq('project_id', updatedAssignment.projectId)
            .eq('judge_id', updatedAssignment.judgeId)
            .eq('assigned_section', updatedAssignment.assignedSection);

        if (error) showNotification(`Error saving progress: ${error.message}`, 'error');
    };

    const submitAssignmentScore = async (completedAssignment: JudgeAssignment) => {
        if (!user) return false;
        setIsPerformingBackgroundTask(true);
        try {
            const dbPayload = mapAssignmentToDb(completedAssignment);

            // This is an `upsert` in case the assignment was created on-the-fly for a Coordinator review.
            const { error } = await supabase.from('judge_assignments').upsert(dbPayload, {
                onConflict: 'project_id,judge_id,assigned_section'
            });

            if (error) {
                showNotification(`Error submitting score: ${error.message}`, 'error');
                return false;
            } else {
                showNotification('Score submitted successfully!', 'success');
                await fetchAllData(user);
                return true;
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const updateUser = async (updatedUser: User) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update(mapUserToProfile(updatedUser))
                .eq('id', updatedUser.id);

            if (error) {
                showNotification(`Error updating profile: ${error.message}`, 'error');
            } else {
                showNotification('Profile updated successfully.', 'success');
                setUser(updatedUser);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const updateUserInList = async (updatedUser: User) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update(mapUserToProfile(updatedUser))
                .eq('id', updatedUser.id);

            if (error) {
                showNotification(`Error updating user ${updatedUser.name}: ${error.message}`, 'error');
            } else {
                showNotification(`User ${updatedUser.name} updated successfully.`, 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const addUserToList = async (newUser: Omit<User, 'id'>, onStatusChange?: (status: string, progress: number) => void) => {
        if (!user) return { success: false, message: 'User not logged in' };
        setIsPerformingBackgroundTask(true);
        if (onStatusChange) onStatusChange('Initializing...', 10);

        try {
            const { data: { session: adminSession } } = await supabase.auth.getSession();
            if (!adminSession) {
                showNotification('Your session has expired. Please log in again.', 'error');
                return { success: false, message: 'Session expired' };
            }

            if (onStatusChange) onStatusChange('Creating User Account...', 30);
            const password = generateRandomPassword();

            const userPayload: Omit<User, 'id'> & { currentRole: UserRole } = {
                ...newUser,
                currentRole: (newUser as Partial<User>).currentRole || getPrimaryRole(newUser.roles),
            };

            // Use temp client to prevent admin logout
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });

            const { data, error } = await tempSupabase.auth.signUp({
                email: userPayload.email,
                password: password,
                options: {
                    data: {
                        ...mapUserToProfile(userPayload),
                        initial_password: password,
                        force_password_change: true,
                    }
                }
            });

            if (error) {
                showNotification(`Error creating user: ${error.message}`, 'error');
                return { success: false, message: error.message };
            } else if (data.user) {
                if (onStatusChange) onStatusChange('Saving User Profile...', 60);
                const profileToUpsert = {
                    id: data.user.id,
                    ...mapUserToProfile(userPayload),
                    initial_password: password,
                    force_password_change: true,
                };
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert(profileToUpsert, { onConflict: 'id' });

                if (profileError) {
                    console.error("CRITICAL: Auth user created but profile upsert failed:", profileError);
                    showNotification(`User auth created, but profile creation failed: ${profileError.message}`, 'error');
                } else {
                    // EmailJS
                    if (onStatusChange) onStatusChange('Sending Welcome Email...', 80);
                    const emailParams = {
                        to_name: userPayload.name,
                        to_email: userPayload.email,
                        initial_password: password,
                    };

                    try {
                        await emailjs.send('service_26hg3x5', 'template_jx9e8gp', emailParams, '1VMHXrjuEgquBbN4B');
                        console.log('EMAIL SUCCESS!');
                    } catch (err: any) {
                        console.error('EMAIL FAILED...', err);
                    }

                    if (onStatusChange) onStatusChange('Process Completed Successfully', 100);
                    showNotification(`User ${userPayload.name} created successfully.`, 'success');
                    await fetchAllData(user);
                    return { success: true, password: password, message: 'User created successfully' };
                }
            }
            return { success: false, message: 'Unknown error occurred' };
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const bulkCreateOrUpdateUsers = useCallback(async (
        usersToCreate: Omit<User, 'id'>[],
        usersToUpdate: User[],
        onProgress?: (progress: { current: number; total: number; task: string }) => void
    ) => {
        if (!user) {
            showNotification('Current user not found. Please log in again.', 'error');
            return;
        }
        const totalOps = usersToCreate.length + usersToUpdate.length;
        if (totalOps === 0) return;

        // Isolated client
        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });

        setIsPerformingBackgroundTask(true);
        if (onProgress) {
            onProgress({ current: 0, total: totalOps, task: 'Processing Users' });
        } else {
            setBulkTaskProgress({ current: 0, total: totalOps, task: 'Processing Users' });
        }

        try {
            const { data: { session: adminSession } } = await supabase.auth.getSession();
            if (!adminSession) {
                showNotification('Your session has expired. Please log in again.', 'error');
                return;
            }

            let completedOps = 0;
            let successCount = 0;
            let failCount = 0;

            for (const newUser of usersToCreate) {
                const stepPrefix = `User ${completedOps + 1}/${totalOps}:`;

                if (onProgress) onProgress({ current: completedOps, total: totalOps, task: `${stepPrefix} Creating Account for ${newUser.name}...` });

                const password = generateRandomPassword();
                const { data, error } = await tempSupabase.auth.signUp({
                    email: newUser.email,
                    password: password,
                    options: {
                        data: {
                            ...mapUserToProfile(newUser),
                            initial_password: password,
                            force_password_change: true,
                        }
                    }
                });

                if (error) {
                    failCount++;
                    console.error(`Failed to create auth for ${newUser.email}: ${error.message}`);
                    if (onProgress) onProgress({ current: completedOps, total: totalOps, task: `${stepPrefix} Failed: ${error.message}` });
                } else if (data.user) {
                    if (onProgress) onProgress({ current: completedOps, total: totalOps, task: `${stepPrefix} Saving Profile...` });

                    const profileToUpsert = { id: data.user.id, ...mapUserToProfile(newUser), initial_password: password, force_password_change: true };
                    // Upsert profile using ADMIN session (main supabase)
                    const { error: profileError } = await supabase.from('profiles').upsert(profileToUpsert, { onConflict: 'id' });
                    if (profileError) {
                        failCount++;
                        console.error(`Failed to upsert profile for ${newUser.email}: ${profileError.message}`);
                    } else {
                        // EmailJS
                        if (onProgress) onProgress({ current: completedOps, total: totalOps, task: `${stepPrefix} Sending Email...` });
                        const emailParams = {
                            to_name: newUser.name,
                            to_email: newUser.email,
                            initial_password: password,
                        };
                        try {
                            await emailjs.send('service_26hg3x5', 'template_jx9e8gp', emailParams, '1VMHXrjuEgquBbN4B');
                        } catch (emailErr) {
                            console.error(`EMAIL FAILED for ${newUser.email}`, emailErr);
                        }
                        successCount++;
                    }
                }
                completedOps++;
                const progressUpdate = { current: completedOps, total: totalOps, task: `Completed ${newUser.name}` };
                if (onProgress) onProgress(progressUpdate);
                else setBulkTaskProgress(progressUpdate);
            }

            for (const userToUpdate of usersToUpdate) {
                const stepPrefix = `User ${completedOps + 1}/${totalOps}:`;
                if (onProgress) onProgress({ current: completedOps, total: totalOps, task: `${stepPrefix} Updating ${userToUpdate.name}...` });

                const { error } = await supabase.from('profiles').update(mapUserToProfile(userToUpdate)).eq('id', userToUpdate.id);
                if (error) {
                    failCount++;
                    console.error(`Failed to update user ${userToUpdate.name}: ${error.message}`);
                } else {
                    successCount++;
                }
                completedOps++;
                const progressUpdate = { current: completedOps, total: totalOps, task: `Updated ${userToUpdate.name}` };
                if (onProgress) onProgress(progressUpdate);
                else setBulkTaskProgress(progressUpdate);
            }

            if (onProgress) onProgress({ current: totalOps, total: totalOps, task: 'Finalizing...' });


            let message = '';
            if (successCount > 0) message += `${successCount} users processed successfully. `;
            if (failCount > 0) message += `${failCount} users failed. Check console for details.`;
            showNotification(message, failCount > 0 ? 'warning' : 'success', 8000);

            await fetchAllData(user);

        } catch (error) {
            console.error('Bulk operation failed:', error);
            showNotification('An unexpected error occurred during bulk operation', 'error');
        } finally {
            setIsPerformingBackgroundTask(false);
            if (!onProgress) setBulkTaskProgress(null);
        }
    }, [user, fetchAllData, showNotification]);

    const deleteUserFromList = async (userId: string) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase.auth.admin.deleteUser(userId);
            if (error) {
                showNotification(`Error deleting user: ${error.message}`, 'error');
            } else {
                showNotification(`User deleted successfully.`, 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    };

    const bulkDeleteUsers = async (userIds: string[]) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        setBulkTaskProgress({ current: 0, total: userIds.length, task: 'Deleting Users' });
        try {
            for (let i = 0; i < userIds.length; i++) {
                await supabase.auth.admin.deleteUser(userIds[i]);
                setBulkTaskProgress({ current: i + 1, total: userIds.length, task: 'Deleting Users' });
            }
            showNotification(`${userIds.length} users deleted successfully.`, 'success');
            await fetchAllData(user);
        } finally {
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
    };

    const bulkUpdateUserRoles = async (userIds: string[], rolesToAdd: UserRole[], rolesToRemove: UserRole[]) => {
        if ((rolesToAdd.length === 0 && rolesToRemove.length === 0) || !user) return;

        setIsPerformingBackgroundTask(true);
        setBulkTaskProgress({ current: 0, total: userIds.length, task: 'Updating Roles' });
        try {
            const usersToUpdate = users.filter(u => userIds.includes(u.id));

            for (let i = 0; i < usersToUpdate.length; i++) {
                const userToUpdate = usersToUpdate[i];
                const currentRoles = new Set<UserRole>(userToUpdate.roles);
                rolesToAdd.forEach(r => currentRoles.add(r));
                rolesToRemove.forEach(r => currentRoles.delete(r));

                // Ensure Judge/Coordinator exclusivity
                if (rolesToAdd.includes(UserRole.JUDGE)) currentRoles.delete(UserRole.COORDINATOR);
                if (rolesToAdd.includes(UserRole.COORDINATOR)) currentRoles.delete(UserRole.JUDGE);

                const newRoles = Array.from(currentRoles);

                const { error } = await supabase
                    .from('profiles')
                    .update({ roles: newRoles, current_role: getPrimaryRole(newRoles) })
                    .eq('id', userToUpdate.id);

                if (error) {
                    showNotification(`Failed to update ${userToUpdate.name}: ${error.message}`, 'error');
                }
                setBulkTaskProgress({ current: i + 1, total: userIds.length, task: 'Updating Roles' });
            }
            showNotification(`Roles updated for ${userIds.length} users.`, 'success');
            await fetchAllData(user);
        } finally {
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
    };


    const addSchoolData = async (newSchool: SchoolLocation) => {
        const { error } = await supabase.from('school_locations').upsert({
            school: newSchool.school,
            region: newSchool.region,
            county: newSchool.county,
            sub_county: newSchool.subCounty,
            zone: newSchool.zone
        }, { onConflict: 'school' });
        if (error) {
            console.warn(`Could not save school location data: ${error.message}`);
        }
    };

    // ...
    // --- REFACTORED: Now includes level-specific logic ---
    const assignJudgeToSectionForLevel = async (judgeId: string, category: string, section: 'Part A' | 'Part B & C', level: CompetitionLevel) => {
        if (!user || !activeEdition) return { success: false, message: 'Admin not found or no active edition.' };

        const judgeUser = users.find(u => u.id === judgeId);
        if (!judgeUser) {
            return { success: false, message: 'Judge not found.' };
        }

        // --- NEW: CONFLICT OF INTEREST CHECK ---
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const assignmentLevelIndex = levelOrder.indexOf(level);
        const adminRoles = judgeUser.roles.filter(r => ADMIN_ROLES.includes(r));

        if (adminRoles.length > 0) {
            const roleToLevelMap: { [key in UserRole]?: CompetitionLevel } = {
                [UserRole.SUB_COUNTY_ADMIN]: CompetitionLevel.SUB_COUNTY,
                [UserRole.COUNTY_ADMIN]: CompetitionLevel.COUNTY,
                [UserRole.REGIONAL_ADMIN]: CompetitionLevel.REGIONAL,
                [UserRole.NATIONAL_ADMIN]: CompetitionLevel.NATIONAL,
            };
            const projectsToAssign = projects.filter(p => p.category === category && p.currentLevel === level && !p.isEliminated);

            for (const adminRole of adminRoles) {
                const adminLevel = roleToLevelMap[adminRole];
                if (adminLevel) {
                    const adminLevelIndex = levelOrder.indexOf(adminLevel);
                    if (assignmentLevelIndex <= adminLevelIndex) {
                        let conflictProject = null;
                        switch (adminRole) {
                            case UserRole.SUB_COUNTY_ADMIN:
                                conflictProject = projectsToAssign.find(p => p.subCounty === judgeUser.subCounty && p.county === judgeUser.county && p.region === judgeUser.region);
                                break;
                            case UserRole.COUNTY_ADMIN:
                                conflictProject = projectsToAssign.find(p => p.county === judgeUser.county && p.region === judgeUser.region);
                                break;
                            case UserRole.REGIONAL_ADMIN:
                                conflictProject = projectsToAssign.find(p => p.region === judgeUser.region);
                                break;
                            case UserRole.NATIONAL_ADMIN:
                                if (level === CompetitionLevel.NATIONAL) conflictProject = projectsToAssign[0];
                                break;
                        }
                        if (conflictProject) {
                            return { success: false, message: `Conflict of interest: As a ${adminRole}, this user cannot judge projects from their own jurisdiction at the ${level} level.` };
                        }
                    }
                }
            }
        }
        // --- END NEW CHECK ---

        // --- NEW LOGIC TO PREVENT RE-JUDGING THE SAME CATEGORY ---
        const newLevelIndex = levelOrder.indexOf(level);

        // Find if this judge has any previous assignments in the same category at a lower level within the current edition.
        const hasJudgedCategoryBefore = assignments.some(assignment => {
            // We only care about assignments for the judge in question.
            if (assignment.judgeId !== judgeId) {
                return false;
            }

            // Find the project associated with the assignment to check its category.
            const project = projects.find(p => p.id === assignment.projectId);
            if (!project || project.category !== category) {
                return false;
            }

            const pastLevelIndex = levelOrder.indexOf(assignment.competitionLevel);

            // If the judge has an assignment for this category at a level lower than the new one, it's a conflict.
            return pastLevelIndex < newLevelIndex;
        });

        if (hasJudgedCategoryBefore) {
            return { success: false, message: `This judge has already evaluated the '${category}' category at a lower competition level and cannot be reassigned to it to avoid bias.` };
        }
        // --- END NEW LOGIC ---

        setIsPerformingBackgroundTask(true);
        let result = { success: false, message: 'An unknown error occurred.' };

        try {
            const projectsToAssign = projects.filter(p =>
                p.category === category &&
                p.currentLevel === level &&
                !p.isEliminated
            );

            if (projectsToAssign.length === 0) {
                result = { success: false, message: `No active projects found in '${category}' at the ${level} level.` };
                return result;
            }

            setBulkTaskProgress({ current: 0, total: projectsToAssign.length, task: 'Assigning Judge' });

            const assignmentsToInsert: JudgeAssignment[] = projectsToAssign.map(p => ({
                projectId: p.id,
                judgeId: judgeId,
                assignedSection: section,
                status: ProjectStatus.NOT_STARTED,
                edition_id: p.edition_id,
                competitionLevel: level,
            }));

            const { error } = await supabase.from('judge_assignments').upsert(assignmentsToInsert.map(mapAssignmentToDb), {
                onConflict: 'project_id,judge_id,assigned_section'
            });

            if (error) {
                result = { success: false, message: `Error assigning judge: ${error.message}` };
            } else {
                const targetUser = users.find(u => u.id === judgeId);
                await supabase.from('audit_logs').insert({
                    performing_admin_id: user.id,
                    performing_admin_name: user.name,
                    target_user_id: judgeId,
                    target_user_name: targetUser?.name || 'Unknown User',
                    action: `Assigned to ${section} for '${category}' at ${level} level.`,
                    notified_admin_role: user.currentRole,
                    scope: { region: user.region, county: user.county, subCounty: user.subCounty },
                    edition_id: activeEdition.id
                });
                if (targetUser && !targetUser.roles.includes(UserRole.JUDGE) && !targetUser.roles.includes(UserRole.COORDINATOR)) {
                    const newRoles = [...targetUser.roles, UserRole.JUDGE];
                    await supabase.from('profiles').update({ roles: newRoles }).eq('id', judgeId);
                }
                result = { success: true, message: `Assigned to ${section} for '${category}' successfully.` };
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
        return result;
    };

    const unassignJudgeFromSectionForLevel = async (judgeId: string, category: string, section: 'Part A' | 'Part B & C', level: CompetitionLevel) => {
        if (!user || !activeEdition) return;

        setIsPerformingBackgroundTask(true);
        setBulkTaskProgress({ current: 0, total: 1, task: 'Unassigning Judge' });
        try {
            const projectsInCategory = projects.filter(p =>
                p.category === category &&
                p.currentLevel === level
            );
            const projectIds = projectsInCategory.map(p => p.id);

            if (projectIds.length === 0) return;

            const { error } = await supabase
                .from('judge_assignments')
                .delete()
                .eq('judge_id', judgeId)
                .eq('assigned_section', section)
                .eq('competition_level', level)
                .in('project_id', projectIds);

            if (error) {
                showNotification(`Error unassigning judge: ${error.message}`, 'error');
            } else {
                const targetUser = users.find(u => u.id === judgeId);
                await supabase.from('audit_logs').insert({
                    performing_admin_id: user.id,
                    performing_admin_name: user.name,
                    target_user_id: judgeId,
                    target_user_name: targetUser?.name || 'Unknown User',
                    action: `Unassigned from ${section} for '${category}' at ${level} level.`,
                    notified_admin_role: user.currentRole,
                    scope: { region: user.region, county: user.county, subCounty: user.subCounty },
                    edition_id: activeEdition.id,
                });
                await fetchAllData(user);
            }
        } finally {
            setBulkTaskProgress({ current: 1, total: 1, task: 'Unassigning Judge' });
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
    };

    const calculateProjectScores = useCallback((projectId: string, level: CompetitionLevel) => {
        const projectAssignments = assignments.filter(a => a.projectId === projectId);
        // FIX: Added filtering by role to accurately identify coordinators.
        // FIX: Explicitly type `new Set()` to `new Set<string>()` to prevent type inference issues when the source array is empty.
        const coordinatorIds = new Set<string>(users.filter(u => u.roles.includes(UserRole.COORDINATOR)).map(u => u.id));

        const finalAssignmentsA = getFinalAssignmentsForSection(projectId, 'Part A', assignments, projects, level, overallHighestLevel, coordinatorIds);
        const finalAssignmentsBC = getFinalAssignmentsForSection(projectId, 'Part B & C', assignments, projects, level, overallHighestLevel, coordinatorIds);

        const scoreA = finalAssignmentsA.length > 0
            ? finalAssignmentsA.reduce((sum, a) => sum + (a.score ?? 0), 0) / finalAssignmentsA.length
            : null;

        const scoreBC = finalAssignmentsBC.length > 0
            ? finalAssignmentsBC.reduce((sum, a) => sum + (a.score ?? 0), 0) / finalAssignmentsBC.length
            : null;

        const allRegularJudgeAssignments = projectAssignments.filter(a => a.competitionLevel === level && !a.isArchived && !coordinatorIds.has(a.judgeId));
        const regularJudgesA = allRegularJudgeAssignments.filter(a => a.assignedSection === 'Part A' && a.status === ProjectStatus.COMPLETED);
        const regularJudgesBC = allRegularJudgeAssignments.filter(a => a.assignedSection === 'Part B & C' && a.status === ProjectStatus.COMPLETED);

        let needsArb = false;
        if (regularJudgesA.length >= 2 && Math.abs((regularJudgesA[0].score ?? 0) - (regularJudgesA[1].score ?? 0)) >= 5) {
            const hasCoordinatorJudged = projectAssignments.some(a => a.competitionLevel === level && coordinatorIds.has(a.judgeId) && a.assignedSection === 'Part A' && a.status === ProjectStatus.COMPLETED);
            if (!hasCoordinatorJudged) needsArb = true;
        }
        if (regularJudgesBC.length >= 2 && Math.abs((regularJudgesBC[0].score ?? 0) - (regularJudgesBC[1].score ?? 0)) >= 5) {
            const hasCoordinatorJudged = projectAssignments.some(a => a.competitionLevel === level && coordinatorIds.has(a.judgeId) && a.assignedSection === 'Part B & C' && a.status === ProjectStatus.COMPLETED);
            if (!hasCoordinatorJudged) needsArb = true;
        }

        return {
            scoreA,
            scoreBC,
            totalScore: (scoreA ?? 0) + (scoreBC ?? 0),
            isFullyJudged: scoreA !== null && scoreBC !== null,
            needsArbitration: needsArb,
        };
    }, [assignments, users, overallHighestLevel, projects]);

    const handleJudgeTimeout = useCallback(async (projectId: string, judgeId: string, section: 'Part A' | 'Part B & C', category: string) => {
        if (!user || !activeEdition) return;
        const coordinatorAssignments = assignments.filter(a => {
            const p = projects.find(pr => pr.id === a.projectId);
            return p && p.category === category && p.currentLevel === viewingLevel && !a.isArchived;
        });
        const assignmentsByJudge = new Map<string, Set<string>>();
        for (const assignment of coordinatorAssignments) {
            if (!assignmentsByJudge.has(assignment.judgeId)) {
                assignmentsByJudge.set(assignment.judgeId, new Set());
            }
            assignmentsByJudge.get(assignment.judgeId)!.add(assignment.assignedSection);
        }
        let coordinatorId: string | undefined;
        for (const [id, sections] of assignmentsByJudge.entries()) {
            if (sections.size === 2) {
                coordinatorId = id;
                break;
            }
        }
        if (coordinatorId) {
            const { error } = await supabase.from('judge_assignments').upsert({
                project_id: projectId,
                judge_id: coordinatorId,
                assigned_section: section,
                status: ProjectStatus.REVIEW_PENDING,
                comments: `Reviewing due to timeout from judge ID: ${judgeId}`,
                edition_id: activeEdition.id,
                competition_level: viewingLevel
            }, { onConflict: 'project_id,judge_id,assigned_section' });
            if (error) {
                showNotification(`Failed to assign for review: ${error.message}`, 'error');
            } else {
                showNotification('Project sent to coordinator for review due to session timeout.', 'warning');
            }
        } else {
            showNotification('Could not find a coordinator to review the timed-out session.', 'error');
        }
    }, [user, assignments, projects, viewingLevel, activeEdition, showNotification]);

    const getTimeLeftInJudgingSession = useCallback(() => {
        if (!isWithinJudgingHours) return null;
        const now = new Date();
        const [endH, endM] = applicableJudgingHours.endTime.split(':').map(Number);
        const endTime = new Date();
        endTime.setHours(endH, endM, 0, 0);
        const difference = endTime.getTime() - now.getTime();
        return difference > 0 ? difference : 0;
    }, [isWithinJudgingHours, applicableJudgingHours]);

    const getProjectJudgingProgress = useCallback((projectId: string, level: CompetitionLevel) => {
        // If all assignments for a project at a given level are archived, it means its results are published for that level.
        const projectAssignmentsForLevel = assignments.filter(a => a.projectId === projectId && a.competitionLevel === level);
        if (projectAssignmentsForLevel.length > 0 && projectAssignmentsForLevel.every(a => a.isArchived)) {
            return { isSectionAComplete: true, isSectionBComplete: true, percentage: 100, statusText: 'Completed' };
        }

        const activeProjectAssignments = projectAssignmentsForLevel.filter(a => !a.isArchived);
        const scores = calculateProjectScores(projectId, level);

        if (scores.needsArbitration) {
            return { isSectionAComplete: false, isSectionBComplete: false, percentage: 50, statusText: 'Review Pending' };
        }
        if (scores.isFullyJudged) {
            return { isSectionAComplete: true, isSectionBComplete: true, percentage: 100, statusText: 'Completed' };
        }

        const completedAssignments = activeProjectAssignments.filter(a => a.status === ProjectStatus.COMPLETED);
        const completedA = completedAssignments.filter(a => a.assignedSection === 'Part A').length;
        const completedBC = completedAssignments.filter(a => a.assignedSection === 'Part B & C').length;
        const neededPerSection = 2;
        const percentage = ((completedA + completedBC) / (neededPerSection * 2)) * 100;
        const statusText = activeProjectAssignments.some(a => a.status !== ProjectStatus.NOT_STARTED) ? 'In Progress' : 'Not Started';

        return {
            isSectionAComplete: completedA >= neededPerSection,
            isSectionBComplete: completedBC >= neededPerSection,
            percentage: Math.min(100, percentage),
            statusText,
        };
    }, [assignments, calculateProjectScores]);

    const isRollbackPossible = useMemo(() => {
        if (!viewingEdition) return false;

        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const viewingLevelIndex = levelOrder.indexOf(viewingLevel);

        // If viewing the final level, rollback is always possible as there's no next level to start judging in.
        if (viewingLevel === CompetitionLevel.NATIONAL) {
            return true;
        }

        // If we're not at the last level, find the next level.
        if (viewingLevelIndex >= levelOrder.length - 1) {
            return true; // Should be covered by the NATIONAL check, but good for safety.
        }
        const nextLevel = levelOrder[viewingLevelIndex + 1];

        // Check if any judging has started at the *next* level for any project.
        // "Judging started" means an assignment has been started or completed for that level.
        const hasJudgingStartedAtNextLevel = assignments.some(a =>
            a.competitionLevel === nextLevel &&
            (a.status === ProjectStatus.IN_PROGRESS || a.status === ProjectStatus.COMPLETED)
        );

        return !hasJudgingStartedAtNextLevel;
    }, [viewingLevel, assignments, viewingEdition]);

    const calculateProjectScoresWithBreakdown = useCallback((projectId: string, level: CompetitionLevel) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return { scoreA: null, scoreB: null, scoreC: null, totalScore: 0, isFullyJudged: false };

        const scores = calculateProjectScores(projectId, level);
        if (!scores.isFullyJudged) return { scoreA: scores.scoreA, scoreB: null, scoreC: null, totalScore: 0, isFullyJudged: false };

        const isRobotics = project.category === 'Robotics';
        const currentBCriteriaIds = isRobotics ? roboticsBCriteriaIds : bCriteriaIds;
        const currentCCriteriaIds = isRobotics ? roboticsCCriteriaIds : cCriteriaIds;

        // FIX: Explicitly type `new Set()` to `new Set<string>()` to prevent type inference issues when the source array is empty.
        const coordinatorIds = new Set<string>(users.filter(u => u.roles.includes(UserRole.COORDINATOR)).map(u => u.id));
        const finalAssignmentsBC = getFinalAssignmentsForSection(projectId, 'Part B & C', assignments, projects, level, overallHighestLevel, coordinatorIds);

        let totalScoreB = 0;
        let totalScoreC = 0;
        let assignmentCount = finalAssignmentsBC.length;

        if (assignmentCount === 0) return { scoreA: scores.scoreA, scoreB: null, scoreC: null, totalScore: scores.totalScore, isFullyJudged: false };

        finalAssignmentsBC.forEach(assignment => {
            if (assignment.scoreBreakdown) {
                let tempB = 0;
                let tempC = 0;
                for (const critId in assignment.scoreBreakdown) {
                    const id = parseInt(critId, 10);
                    const score = assignment.scoreBreakdown[id];
                    if (currentBCriteriaIds.has(id)) tempB += score;
                    else if (currentCCriteriaIds.has(id)) tempC += score;
                }
                totalScoreB += tempB;
                totalScoreC += tempC;
            }
        });

        return {
            scoreA: scores.scoreA,
            scoreB: totalScoreB / assignmentCount,
            scoreC: totalScoreC / assignmentCount,
            totalScore: scores.totalScore,
            isFullyJudged: scores.isFullyJudged,
        };
    }, [projects, assignments, users, calculateProjectScores, overallHighestLevel]);

    const calculateRankingsAndPointsForProjects = useCallback((projectsToRank: Project[], level: CompetitionLevel): RankingData => {
        const projectsWithScores = projectsToRank
            .map(p => {
                const scores = calculateProjectScores(p.id, level);
                return { ...p, totalScore: scores.isFullyJudged ? scores.totalScore : -1 };
            })
            .filter(p => p.totalScore !== -1);
        const projectsByCategory: { [key: string]: typeof projectsWithScores } = {};
        projectsWithScores.forEach(p => {
            if (!projectsByCategory[p.category]) projectsByCategory[p.category] = [];
            projectsByCategory[p.category].push(p);
        });
        const projectsWithRank: ProjectWithRank[] = [];
        Object.values(projectsByCategory).forEach(categoryProjects => {
            categoryProjects.sort((a, b) => b.totalScore - a.totalScore);
            categoryProjects.forEach((p, index) => {
                const rank = index > 0 && categoryProjects[index - 1].totalScore === p.totalScore
                    ? projectsWithRank.find(pr => pr.id === categoryProjects[index - 1].id)!.categoryRank
                    : index + 1;
                const points = rank <= 4 ? 5 - rank : 0;
                projectsWithRank.push({ ...p, categoryRank: rank, points });
            });
        });
        const calculateEntityRanking = (groupBy: keyof Project) => {
            const pointsByName: { [name: string]: { totalPoints: number, parent?: string } } = {};
            projectsWithRank.forEach(p => {
                const name = p[groupBy] as string;
                if (name) {
                    if (!pointsByName[name]) pointsByName[name] = { totalPoints: 0 };
                    pointsByName[name].totalPoints += p.points;
                    if (groupBy === 'subCounty') pointsByName[name].parent = p.county;
                    else if (groupBy === 'county') pointsByName[name].parent = p.region;
                    else if (groupBy === 'zone') pointsByName[name].parent = p.subCounty;
                }
            });
            // FIX: Replaced buggy .map() chain with a more robust multi-step ranking logic using .forEach() to prevent accessing properties that don't exist yet during iteration.
            const sortedEntities: { name: string, totalPoints: number, parent?: string }[] = Object.entries(pointsByName)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.totalPoints - a.totalPoints);

            const rankedEntities: RankedEntity[] = [];
            sortedEntities.forEach((entity, index) => {
                const rank = index > 0 && sortedEntities[index - 1].totalPoints === entity.totalPoints
                    ? rankedEntities[index - 1].rank
                    : index + 1;
                rankedEntities.push({ ...entity, rank });
            });
            return rankedEntities;
        };
        const schoolRanking = calculateEntityRanking('school');
        const regionRanking = calculateEntityRanking('region');
        const groupByParent = (entities: RankedEntity[]) => {
            return entities.reduce((acc, entity) => {
                const parent = entity.parent;
                if (parent) {
                    if (!acc[parent]) acc[parent] = [];
                    acc[parent].push(entity);
                }
                return acc;
            }, {} as { [parent: string]: RankedEntity[] });
        };
        const zoneRanking = groupByParent(calculateEntityRanking('zone'));
        const subCountyRanking = groupByParent(calculateEntityRanking('subCounty'));
        const countyRanking = groupByParent(calculateEntityRanking('county'));
        return { projectsWithPoints: projectsWithRank, schoolRanking, zoneRanking, subCountyRanking, countyRanking, regionRanking };
    }, [calculateProjectScores]);

    const calculateRankingsAndPoints = useCallback((): RankingData => {
        return calculateRankingsAndPointsForProjects(projects, viewingLevel);
    }, [projects, viewingLevel, calculateRankingsAndPointsForProjects]);

    const setSubmissionDeadline = useCallback(async (deadline: string | null) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const key = getDeadlineKeyForAdmin(user);
            const { error } = await updateSetting(key, deadline);
            if (error) {
                showNotification(`Error setting deadline: ${error.message}`, 'error');
            } else {
                showNotification('Submission deadline updated successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const setJudgingTimerSettings = useCallback(async (settings: JudgingTimerSettings) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const keyPrefix = getTimerKeyPrefixForAdmin(user);
            const settingsPayload = [
                { key: `min_time_a${keyPrefix}`, value: settings.minTimeA },
                { key: `max_time_a${keyPrefix}`, value: settings.maxTimeA },
                { key: `min_time_bc${keyPrefix}`, value: settings.minTimeBC },
                { key: `max_time_bc${keyPrefix}`, value: settings.maxTimeBC },
            ];
            const promises = settingsPayload.map(s => updateSetting(s.key, s.value));
            const results = await Promise.all(promises);
            const firstError = results.find(r => r.error);

            if (firstError) {
                showNotification(`Error saving timer settings: ${firstError.error!.message}`, 'error');
            } else {
                showNotification('Judging timer settings saved successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const publishResults = useCallback(async (admin: User): Promise<{ success: boolean; message: string }> => {
        if (!viewingEdition || !user) return { success: false, message: "No active edition or user." };

        setIsPerformingBackgroundTask(true);

        try {
            const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
            const currentLevel = viewingLevel;
            const currentLevelIndex = levelOrder.indexOf(currentLevel);
            const nextLevel = currentLevelIndex < levelOrder.length - 1 ? levelOrder[currentLevelIndex + 1] : null;

            // 1. Identify all projects within the admin's scope that are at the current level
            const projectsInScope = projects.filter(p => {
                if ([UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(admin.currentRole)) return true;
                if (admin.currentRole === UserRole.REGIONAL_ADMIN) return p.region === admin.region;
                if (admin.currentRole === UserRole.COUNTY_ADMIN) return p.county === admin.county && p.region === admin.region;
                if (admin.currentRole === UserRole.SUB_COUNTY_ADMIN) return p.subCounty === admin.subCounty && p.county === admin.county && p.region === admin.region;
                return false;
            });

            const projectsToProcess = projectsInScope.filter(p => p.currentLevel === currentLevel && !p.isEliminated);

            // 2. Calculate rankings and determine which projects to update
            const rankingData = calculateRankingsAndPointsForProjects(projectsToProcess, currentLevel);
            const projectsToUpdate: Partial<Project>[] = [];

            rankingData.projectsWithPoints.forEach(p => {
                if (p.categoryRank <= 4) {
                    if (nextLevel) {
                        projectsToUpdate.push({ id: p.id, currentLevel: nextLevel });
                    }
                    // For national level, we don't need to update project status directly
                    // The completion is indicated by archiving all assignments (done later)
                } else {
                    projectsToUpdate.push({ id: p.id, isEliminated: true });
                }
            });

            // 3. Identify coordinators who judged at this level within scope
            const projectIdsToProcess = new Set(projectsToProcess.map(p => p.id));

            // For national level, we need to archive ALL assignments for ALL projects at this level
            // For other levels, only archive assignments for projects being processed
            let assignmentsToArchive = [];
            if (currentLevel === CompetitionLevel.NATIONAL) {
                // Get all projects at national level
                const allNationalProjects = projects.filter(p => p.currentLevel === currentLevel);
                const allNationalProjectIds = new Set(allNationalProjects.map(p => p.id));
                assignmentsToArchive = assignments.filter(a => allNationalProjectIds.has(a.projectId) && a.competitionLevel === currentLevel && !a.isArchived);
            } else {
                assignmentsToArchive = assignments.filter(a => projectIdsToProcess.has(a.projectId) && a.competitionLevel === currentLevel && !a.isArchived);
            }

            const assignmentsForLevel = assignmentsToArchive;

            const userIdsToSnapshot = new Set<string>(assignmentsForLevel.map(a => a.judgeId));
            const roleSnapshot: Record<string, { roles: UserRole[]; currentRole: UserRole; coordinatedCategory: string | null }> = {};
            users.forEach(u => {
                if (userIdsToSnapshot.has(u.id)) {
                    roleSnapshot[u.id] = {
                        roles: [...u.roles],
                        currentRole: u.currentRole,
                        coordinatedCategory: (u.coordinatedCategory ?? null) as string | null,
                    };
                }
            });
            const snapshotKey = `role_snapshot_${viewingEdition.id}_${currentLevel}`;
            const { error: snapshotError } = await updateSetting(snapshotKey, JSON.stringify(roleSnapshot));
            if (snapshotError) {
                showNotification(`Failed to persist role snapshot for rollback: ${snapshotError.message}`, 'warning');
            }

            const assignmentsByJudge = assignmentsForLevel.reduce((acc, a) => {
                if (!acc[a.judgeId]) acc[a.judgeId] = new Set<string>();
                acc[a.judgeId].add(a.assignedSection);
                return acc;
            }, {} as Record<string, Set<string>>);

            const coordinatorIdsToReset = new Set<string>();
            for (const judgeId in assignmentsByJudge) {
                if (assignmentsByJudge[judgeId].size === 2) {
                    coordinatorIdsToReset.add(judgeId);
                }
            }
            const coordinatorsToReset = users.filter(u => coordinatorIdsToReset.has(u.id));

            // Setup bulk progress
            const totalTasks = projectsToUpdate.length + 1 + coordinatorsToReset.length + 1; // Projects + archive + coordinators + audit log
            let completedTasks = 0;

            // 4. Update projects (promote/eliminate)
            setBulkTaskProgress({ current: completedTasks, total: totalTasks, task: 'Promoting Projects' });
            for (const project of projectsToUpdate) {
                const { error } = await supabase.from('projects').update(mapProjectToDb(project)).eq('id', project.id!);
                if (error) {
                    showNotification(`Failed to update project: ${error.message}`, 'error');
                    setIsPerformingBackgroundTask(false);
                    setBulkTaskProgress(null);
                    return { success: false, message: 'An error occurred during publishing.' };
                }
                completedTasks++;
                setBulkTaskProgress({ current: completedTasks, total: totalTasks, task: 'Promoting Projects' });
            }

            // 5. Archive all assignments for this level
            completedTasks++;
            setBulkTaskProgress({ current: completedTasks, total: totalTasks, task: 'Archiving Scores' });

            // For national level, archive ALL assignments for ALL projects at this level
            // For other levels, only archive assignments for projects being processed
            let archiveError;
            if (currentLevel === CompetitionLevel.NATIONAL) {
                // Get all projects at national level
                const allNationalProjects = projects.filter(p => p.currentLevel === currentLevel);
                const allNationalProjectIds = new Set(allNationalProjects.map(p => p.id));
                const { error } = await supabase.from('judge_assignments').update({ is_archived: true }).in('project_id', Array.from(allNationalProjectIds)).eq('competition_level', currentLevel);
                archiveError = error;
            } else {
                const { error } = await supabase.from('judge_assignments').update({ is_archived: true }).in('project_id', Array.from(projectIdsToProcess)).eq('competition_level', currentLevel);
                archiveError = error;
            }

            if (archiveError) {
                showNotification(`Failed to archive assignments: ${archiveError.message}`, 'error'); // Continue but warn
            }

            // 6. Reset Coordinator Roles
            setBulkTaskProgress({ current: completedTasks, total: totalTasks, task: 'Resetting Coordinator Roles' });
            for (const coordinator of coordinatorsToReset) {
                const newRoles = Array.from(new Set([...coordinator.roles.filter(r => r !== UserRole.COORDINATOR), UserRole.JUDGE]));
                const newCurrentRole = coordinator.currentRole === UserRole.COORDINATOR ? UserRole.JUDGE : coordinator.currentRole;

                const { error: resetError } = await supabase.from('profiles').update({
                    roles: newRoles,
                    current_role: newCurrentRole,
                    coordinated_category: null
                }).eq('id', coordinator.id);

                if (resetError) {
                    showNotification(`Failed to reset role for ${coordinator.name}: ${resetError.message}`, 'warning');
                }
                completedTasks++;
                setBulkTaskProgress({ current: completedTasks, total: totalTasks, task: 'Resetting Coordinator Roles' });
            }
            if (currentLevel === CompetitionLevel.NATIONAL && viewingEdition) {
                setBulkTaskProgress(prev => prev ? { ...prev, task: 'Completing National Level' } : null);
                const flagKey = `edition_completed_${viewingEdition.id}`;
                const { error: completeFlagError } = await updateSetting(flagKey, true);
                if (completeFlagError) {
                    showNotification(`Failed to set edition completed flag: ${completeFlagError.message}`, 'warning');
                }
            }

            // 8. Log and Refresh
            completedTasks++;
            setBulkTaskProgress({ current: completedTasks, total: totalTasks, task: 'Finalizing' });
            await supabase.from('audit_logs').insert({
                performing_admin_id: admin.id,
                performing_admin_name: admin.name,
                target_user_id: admin.id,
                target_user_name: admin.name,
                action: `Published results for ${currentLevel} level.`,
                notified_admin_role: admin.currentRole,
                scope: { region: admin.region, county: admin.county, subCounty: admin.subCounty },
                edition_id: viewingEdition.id,
            });

            await fetchAllData(user);

            let successMessage = `Results published successfully!`;
            if (nextLevel) {
                const promotedCount = projectsToUpdate.filter(p => !p.isEliminated).length;
                successMessage += ` ${promotedCount} projects promoted.`;
            } else {
                successMessage += ` National winners have been determined.`;
            }
            if (currentLevel === CompetitionLevel.NATIONAL) {
                successMessage += ` The competition has been marked as completed.`;
            }
            if (coordinatorsToReset.length > 0) {
                successMessage += ` ${coordinatorsToReset.length} coordinator roles were reset to Judge.`;
            }
            return { success: true, message: successMessage };
        } finally {
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
    }, [projects, assignments, users, viewingLevel, viewingEdition, calculateRankingsAndPointsForProjects, showNotification, fetchAllData, user]);

    const setJudgingHours = useCallback(async (hours: JudgingHoursSettings) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const keyPrefix = getTimerKeyPrefixForAdmin(user);
            const settingsPayload = [
                { key: `judging_start_time${keyPrefix}`, value: hours.startTime },
                { key: `judging_end_time${keyPrefix}`, value: hours.endTime },
            ];
            const promises = settingsPayload.map(s => updateSetting(s.key, s.value));
            const results = await Promise.all(promises);
            const firstError = results.find(r => r.error);

            if (firstError) {
                showNotification(`Error saving judging hours: ${firstError.error!.message}`, 'error');
            } else {
                showNotification('Judging hours saved successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const setRoboticsMissions = useCallback(async (missions: { mission1: string, mission2: string }) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const settingsPayload = [
                { key: 'robotics_mission_1', value: missions.mission1 },
                { key: 'robotics_mission_2', value: missions.mission2 },
            ];
            const promises = settingsPayload.map(s => updateSetting(s.key, s.value));
            const results = await Promise.all(promises);
            const firstError = results.find(r => r.error);

            if (firstError) {
                showNotification(`Error saving robotics missions: ${firstError.error!.message}`, 'error');
            } else {
                showNotification('Robotics missions saved successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const unpublishResults = useCallback(async (admin: User): Promise<{ success: boolean; message: string }> => {
        if (!viewingEdition || !user) return { success: false, message: "No active edition or user." };

        setIsPerformingBackgroundTask(true);
        try {
            const currentLevel = viewingLevel;
            const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
            const currentLevelIndex = levelOrder.indexOf(currentLevel);
            const nextLevel = currentLevelIndex < levelOrder.length - 1 ? levelOrder[currentLevelIndex + 1] : null;

            // 1. If national level, clear the edition completed flag
            if (currentLevel === CompetitionLevel.NATIONAL && viewingEdition) {
                const flagKey = `edition_completed_${viewingEdition.id}`;
                const { error: clearFlagError } = await updateSetting(flagKey, null);
                if (clearFlagError) {
                    showNotification(`Failed to clear edition completed flag: ${clearFlagError.message}`, 'warning');
                }
            }

            // 2. Find all projects at the current level that were affected by publishing
            const projectsAtCurrentLevel = projects.filter(p => p.currentLevel === currentLevel);

            // 3. Roll back project statuses - restore all projects to their pre-publishing state
            setBulkTaskProgress({ current: 0, total: projectsAtCurrentLevel.length, task: 'Rolling Back Project Status' });
            for (let i = 0; i < projectsAtCurrentLevel.length; i++) {
                const project = projectsAtCurrentLevel[i];
                // During publishing, projects were either promoted to next level or marked as eliminated
                // During unpublishing, we restore them all to the current level and not eliminated
                const { error } = await supabase.from('projects')
                    .update(mapProjectToDb({
                        id: project.id,
                        currentLevel: currentLevel, // Restore to current level
                        isEliminated: false // Restore to not eliminated
                    }))
                    .eq('id', project.id);

                if (error) {
                    showNotification(`Failed to roll back project: ${error.message}`, 'error');
                    return { success: false, message: 'An error occurred during rollback.' };
                }
                setBulkTaskProgress({ current: i + 1, total: projectsAtCurrentLevel.length, task: 'Rolling Back Project Status' });
            }

            const assignmentsForLevel = assignments.filter(a => a.competitionLevel === currentLevel);
            if (assignmentsForLevel.length > 0) {
                const { error: unarchiveError } = await supabase.from('judge_assignments')
                    .update({ is_archived: false })
                    .eq('competition_level', currentLevel)
                    .eq('edition_id', viewingEdition.id);

                if (unarchiveError) {
                    showNotification(`Failed to un-archive assignments: ${unarchiveError.message}`, 'error');
                }
            }

            const snapshotKey = `role_snapshot_${viewingEdition.id}_${currentLevel}`;
            const { data: snapshotRows, error: snapshotSelectError } = await supabase
                .from('settings')
                .select('value')
                .eq('key', snapshotKey)
                .limit(1);
            if (snapshotSelectError) {
                showNotification(`Failed to read role snapshot: ${snapshotSelectError.message}`, 'warning');
            }

            const snapshotValue = Array.isArray(snapshotRows) && snapshotRows.length > 0 ? snapshotRows[0].value : null;
            if (snapshotValue) {
                let parsed: Record<string, { roles: UserRole[]; currentRole: UserRole; coordinatedCategory: string | null }> | null = null;
                try {
                    parsed = JSON.parse(snapshotValue);
                } catch (e) {
                    parsed = null;
                }

                if (parsed) {
                    const ids = Object.keys(parsed);
                    setBulkTaskProgress({ current: 0, total: ids.length, task: 'Restoring Roles (Snapshot)' });
                    for (let i = 0; i < ids.length; i++) {
                        const userId = ids[i];
                        const snap = parsed[userId];
                        const { error: roleRestoreError } = await supabase
                            .from('profiles')
                            .update({
                                roles: snap.roles,
                                current_role: snap.currentRole,
                                coordinated_category: snap.coordinatedCategory,
                            })
                            .eq('id', userId);
                        if (roleRestoreError) {
                            showNotification(`Failed to restore roles for a user: ${roleRestoreError.message}`, 'warning');
                        }
                        setBulkTaskProgress({ current: i + 1, total: ids.length, task: 'Restoring Roles (Snapshot)' });
                    }
                    await updateSetting(snapshotKey, null);
                } else {
                    showNotification('Role snapshot found but could not be parsed. Falling back to heuristic restoration.', 'warning');
                }
            } else {
                showNotification('No pre-publish role snapshot found. Skipping role restoration.', 'warning');
            }

            await supabase.from('audit_logs').insert({
                performing_admin_id: admin.id,
                performing_admin_name: admin.name,
                target_user_id: admin.id,
                target_user_name: admin.name,
                action: `Rolled back results for ${currentLevel} level.`,
                notified_admin_role: admin.currentRole,
                scope: { region: admin.region, county: admin.county, subCounty: admin.subCounty },
                edition_id: viewingEdition.id,
            });
            await fetchAllData(user);
            return { success: true, message: 'Results rolled back successfully.' };
        } finally {
            setIsPerformingBackgroundTask(false);
            setBulkTaskProgress(null);
        }
    }, [projects, viewingLevel, viewingEdition, assignments, users, showNotification, fetchAllData, user]);

    const getProjectJudgingDetails = useCallback((projectId: string, level: CompetitionLevel): JudgingDetails[] => {
        const projectAssignments = assignments.filter(a => a.projectId === projectId && a.competitionLevel === level);
        // FIX: Explicitly type the Map to prevent `userMap.get` from returning `unknown`, which causes a downstream error when accessing `.name`.
        const userMap = new Map<string, User>(users.map(u => [u.id, u]));
        return projectAssignments.map(a => ({
            judgeName: userMap.get(a.judgeId)?.name || 'Unknown Judge',
            assignedSection: a.assignedSection,
            score: a.score,
            scoreBreakdown: a.scoreBreakdown,
            comments: a.comments,
            recommendations: a.recommendations,
        }));
    }, [assignments, users]);

    const getCategoryStats = useCallback((category: string, level: CompetitionLevel): CategoryStats | null => {
        const projectsInCategory = projects.filter(p => p.category === category && p.currentLevel === level);
        if (projectsInCategory.length === 0) return null;
        const scores = projectsInCategory.map(p => {
            const scoreData = calculateProjectScores(p.id, level);
            return scoreData.isFullyJudged ? scoreData.totalScore : null;
        }).filter((s): s is number => s !== null);
        if (scores.length === 0) return null;
        return {
            min: Math.min(...scores),
            max: Math.max(...scores),
            average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
            count: projectsInCategory.length,
        };
    }, [projects, calculateProjectScores]);

    const markAuditLogAsRead = useCallback(async (logId: string) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase.from('audit_logs').update({ is_read: true }).eq('id', logId);
            if (error) {
                showNotification(`Failed to mark as read: ${error.message}`, 'error');
            } else {
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const markAllAuditLogsAsRead = useCallback(async () => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const { error } = await supabase.from('audit_logs').update({ is_read: true }).eq('is_read', false).eq('notified_admin_role', user.currentRole);
            if (error) {
                showNotification(`Failed to mark all as read: ${error.message}`, 'error');
            } else {
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, showNotification, fetchAllData]);

    const sendPasswordResetEmail = useCallback(async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/#/reset-password',
        });
        if (error) {
            showNotification(`Error sending reset email: ${error.message}`, 'error');
            return { error: error.message };
        }
        showNotification('Password reset link sent. Please check your email.', 'success');
        return { error: null };
    }, [showNotification]);

    const updatePassword = useCallback(async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            showNotification(`Error updating password: ${error.message}`, 'error');
            return { error: error.message };
        }
        return { error: null };
    }, [showNotification]);

    // --- NEW --- Certificate design functions
    const generateCertificateDesigns = useCallback(async (prompt: string): Promise<string[]> => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const fullPrompt = `Generate a professional certificate background image for a science fair. A4 landscape format. The design should be elegant and mostly around the borders, leaving a large, clear, light-colored area in the center for text. Do not include any text in the image. The theme is: ${prompt}`;

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 4,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });

        return response.generatedImages.map(img => img.image.imageBytes);
    }, []);

    const saveCertificateDesign = useCallback(async (designBase64: string) => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const key = getCertificateDesignKeyForAdmin(user);
            const { error } = await updateSetting(key, designBase64);
            if (error) {
                showNotification(`Error saving certificate design: ${error.message}`, 'error');
            } else {
                showNotification('Certificate design saved successfully.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, fetchAllData, showNotification]);

    const removeCertificateDesign = useCallback(async () => {
        if (!user) return;
        setIsPerformingBackgroundTask(true);
        try {
            const key = getCertificateDesignKeyForAdmin(user);
            const { error } = await updateSetting(key, null);
            if (error) {
                showNotification(`Error removing design: ${error.message}`, 'error');
            } else {
                showNotification('Custom certificate design removed.', 'success');
                await fetchAllData(user);
            }
        } finally {
            setIsPerformingBackgroundTask(false);
        }
    }, [user, fetchAllData, showNotification]);

    return (
        <AppContext.Provider value={{
            user, users, theme, projects, assignments, activeJudgingInfo, schoolData, geographicalData,
            submissionDeadline, allDeadlines, auditLogs, notification, isLoading, isPerformingBackgroundTask, bulkTaskProgress,
            applicableTimerSettings, allTimerSettings, applicableJudgingHours, allJudgingHours, isWithinJudgingHours,
            roboticsMissions, isRollbackPossible, isJudgingStarted, applicableCertificateDesign, isEditionCompleted,
            editions, activeEdition, viewingEdition, isHistoricalView,
            overallHighestLevel, viewingLevel,
            setViewingLevel,
            setActiveJudgingInfo,
            showNotification,
            setSubmissionDeadline,
            setJudgingTimerSettings,
            setJudgingHours,
            setRoboticsMissions,
            handleJudgeTimeout,
            getTimeLeftInJudgingSession,
            generateCertificateDesigns, saveCertificateDesign, removeCertificateDesign,
            login, logout, switchRole, toggleTheme, createPatronAccount, changePassword,
            addProject, updateProject, deleteProject,
            startJudging, updateAssignment, submitAssignmentScore,
            updateUser, updateUserInList, addUserToList, bulkCreateOrUpdateUsers, deleteUserFromList, bulkDeleteUsers, bulkUpdateUserRoles,
            addSchoolData,
            assignJudgeToSectionForLevel, unassignJudgeFromSectionForLevel,
            calculateProjectScores,
            getProjectJudgingProgress,
            calculateProjectScoresWithBreakdown,
            calculateRankingsAndPoints,
            calculateRankingsAndPointsForProjects,
            publishResults,
            unpublishResults,
            getProjectJudgingDetails,
            getCategoryStats,
            markAuditLogAsRead,
            markAllAuditLogsAsRead,
            sendPasswordResetEmail,
            updatePassword,
            createEdition, updateEdition, deleteEdition, switchActiveEdition, switchViewingEdition, completeEdition
        }}>
            {children}
        </AppContext.Provider>
    );
};
