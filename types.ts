// FIX: Removed circular import of 'UserRole' from './types' which caused a declaration conflict.

export enum UserRole {
  SUPER_ADMIN = 'Super Admin',
  NATIONAL_ADMIN = 'National Admin',
  REGIONAL_ADMIN = 'Regional Admin',
  COUNTY_ADMIN = 'County Admin',
  SUB_COUNTY_ADMIN = 'Sub-County Admin',
  JUDGE = 'Judge',
  COORDINATOR = 'Coordinator',
  PATRON = 'Patron',
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[]; // Changed from 'role' to 'roles'
  currentRole: UserRole; // Added to track active role
  password?: string;
  initialPassword?: string;
  forcePasswordChange?: boolean;
  school?: string;
  coordinatedCategory?: string;
  // New fields for Patron Biodata
  tscNumber?: string;
  idNumber?: string;
  phoneNumber?: string;
  region?: string;
  county?: string;
  subCounty?: string;
  zone?: string;
  subjects?: string[];
  // --- NEW WORK JURISDICTION FIELDS ---
  workRegion?: string;
  workCounty?: string;
  workSubCounty?: string;
}

export enum ProjectStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  REVIEW_PENDING = 'Review Pending',
  WAITING = 'Waiting for Judging',
  AWAITING_APPROVAL = 'Awaiting Approval',
  REJECTED = 'Rejected',
}

// --- NEW TYPES FOR PROMOTION SYSTEM ---
export enum CompetitionLevel {
  SUB_COUNTY = 'Sub-County',
  COUNTY = 'County',
  REGIONAL = 'Regional',
  NATIONAL = 'National',
}

export interface Project {
  id: string;
  title: string;
  category: string;
  projectRegistrationNumber: string;
  region: string;
  county: string;
  subCounty: string;
  zone: string;
  school: string;
  students: string[];
  patronId?: string;
  status: ProjectStatus;
  currentLevel: CompetitionLevel;
  isEliminated: boolean;
  overrideScoreA?: number;
  edition_id: number;
  // New fields for Abstract & AI Analysis
  abstract?: string;
  aiAnalysis?: {
    aiScore: number; // Percentage
    titleSuggestion?: string;
    categorySuggestion?: string;
  };
  plagiarismScore?: number; // Percentage
  plagiarismDetails?: {
    matchedProjectTitle: string;
    school: string;
    edition: string;
    similarity: number;
  };
  rejectionReason?: string;
}

export interface JudgeAssignment {
  projectId: string;
  judgeId: string;
  assignedSection: 'Part A' | 'Part B & C';
  status: ProjectStatus;
  score?: number;
  scoreBreakdown?: { [key: number]: number };
  comments?: string;
  recommendations?: string;
  isArchived?: boolean;
  missionDescriptions?: { [key: number]: string };
  edition_id: number;
  competitionLevel: CompetitionLevel;
}

export interface JudgingCriterion {
  id: number;
  text: string;
  details: string;
  maxScore: number;
  step?: number;
  originalSection?: 'A' | 'B' | 'C';
}

export interface JudgingSection {
  id: string;
  title: string;
  description: string;
  criteria: JudgingCriterion[];
  totalMaxScore: number;
  subSectionDetails?: {
    [key: string]: { title: string; description: string; };
  };
}

export interface SchoolLocation {
  school: string;
  region: string;
  county: string;
  subCounty: string;
  zone: string;
}

// --- NEW TYPES FOR RANKING SYSTEM ---

export interface ProjectWithRank extends Project {
  totalScore: number;
  categoryRank: number;
  points: number;
}

export interface RankedEntity {
  name: string;
  totalPoints: number;
  rank: number;
  parent?: string; // e.g., a county's parent is its region
}

export interface RankingData {
  projectsWithPoints: ProjectWithRank[];
  schoolRanking: RankedEntity[];
  // Keys are the parent entities
  zoneRanking: { [subCounty: string]: RankedEntity[] };
  subCountyRanking: { [county: string]: RankedEntity[] };
  countyRanking: { [region: string]: RankedEntity[] };
  regionRanking: RankedEntity[];
}

// --- NEW TYPE FOR AUDIT TRAIL ---
export interface AuditLog {
  id: string;
  timestamp: string; // ISO string
  performing_admin_id: string;
  performing_admin_name: string;
  target_user_id: string;
  target_user_name: string;
  action: string;
  is_read: boolean;
  notified_admin_role: UserRole; // The role of the admin who should see this notification
  scope?: { // The geographical scope of the action
    region?: string;
    county?: string;
    subCounty?: string;
  };
  edition_id: number;
}

// --- NEW TYPES FOR DETAILED PATRON FEEDBACK ---
export interface JudgingDetails {
  judgeName: string;
  assignedSection: 'Part A' | 'Part B & C';
  score?: number;
  scoreBreakdown?: { [key: number]: number };
  comments?: string;
  recommendations?: string;
}

export interface CategoryStats {
  min: number;
  max: number;
  average: number;
  count: number;
}

// --- NEW: EDITION TYPE ---
export interface Edition {
  id: number;
  name: string;
  year: number;
  is_active: boolean;
}