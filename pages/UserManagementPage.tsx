import React, { useState, useContext, useMemo, FormEvent, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { AppContext } from '../context/AppContext';
import { User, UserRole, CompetitionLevel, Project, JudgeAssignment, ProjectStatus } from '../types';
import { UserPlus, Edit, Trash2, Settings, Search, AlertCircle, Info, KeyRound, Users, Eye, FileDown, CheckCircle, Clock, Hourglass } from 'lucide-react';
import BulkOperationsModal from '../components/admin/BulkOperationsModal'; // --- NEW IMPORT ---
import JudgeCategoryAssignmentModal from '../components/admin/JudgeCategoryAssignmentModal';
import JudgeAssignmentsViewModal from '../components/admin/JudgeAssignmentsViewModal'; // --- NEW IMPORT ---
import BulkRoleAssignModal from '../components/admin/BulkRoleAssignModal'; // --- NEW IMPORT ---
import ViewUserProfileModal from '../components/admin/ViewUserProfileModal';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import CompetitionLevelSwitcher from '../components/CompetitionLevelSwitcher';


const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN];
const JUDGE_ROLES = [UserRole.JUDGE, UserRole.COORDINATOR];

const getCreatableRoles = (adminRole: UserRole): UserRole[] => {
    const roleHierarchy = [
        UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
        UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN, UserRole.COORDINATOR,
        UserRole.JUDGE, UserRole.PATRON
    ];
    const adminIndex = roleHierarchy.indexOf(adminRole);
    if (adminIndex === -1) return [];
    return roleHierarchy.slice(adminIndex + 1);
};

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

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

// --- NEW, IMPROVED ADD/EDIT USER MODAL ---
const AddEditUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    userToEdit: User | null;
}> = ({ isOpen, onClose, userToEdit }) => {
    const { user: currentUser, users, addUserToList, updateUserInList, geographicalData, showNotification } = useContext(AppContext);

    const [formData, setFormData] = useState<Partial<User>>({ roles: [] });
    const [validationError, setValidationError] = useState('');
    
    const [workCountiesForSelect, setWorkCountiesForSelect] = useState<string[]>([]);
    const [workSubCountiesForSelect, setWorkSubCountiesForSelect] = useState<string[]>([]);

    // --- NEW: State for real-time user search ---
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [activeSuggestionField, setActiveSuggestionField] = useState<'email' | 'tscNumber' | 'idNumber' | null>(null);
    const suggestionRef = useRef<HTMLUListElement>(null);
    
    const creatableRoles = useMemo(() => currentUser ? getCreatableRoles(currentUser.currentRole) : [], [currentUser]);
    
    const isSelfEditing = useMemo(() => userToEdit && currentUser && userToEdit.id === currentUser.id, [userToEdit, currentUser]);

    const showWorkGeoFields = useMemo(() => {
        return formData?.roles?.some(r => [UserRole.JUDGE, UserRole.COORDINATOR].includes(r));
    }, [formData?.roles]);

    const isJudgeOrCoordinatorOrPatron = useMemo(() => {
        return formData.roles?.some(r => [UserRole.JUDGE, UserRole.COORDINATOR, UserRole.PATRON].includes(r));
    }, [formData.roles]);


    const { regionsForSelect, countiesForSelect, subCountiesForSelect, isRegionLocked, isCountyLocked, isSubCountyLocked } = useMemo(() => {
        if (!currentUser) return { regionsForSelect: [], countiesForSelect: [], subCountiesForSelect: [], isRegionLocked: true, isCountyLocked: true, isSubCountyLocked: true };
        
        let regions = Object.keys(geographicalData).sort();
        let counties: string[] = [];
        let subCounties: string[] = [];
        
        let regionLocked = false;
        let countyLocked = false;
        let subCountyLocked = false;

        switch(currentUser.currentRole) {
            case UserRole.REGIONAL_ADMIN:
                regions = currentUser.region ? [currentUser.region] : [];
                counties = formData.region ? Object.keys(geographicalData[formData.region] || {}).sort() : [];
                subCounties = (formData.region && formData.county) ? Object.keys(geographicalData[formData.region][formData.county] || {}).sort() : [];
                regionLocked = true;
                break;
            case UserRole.COUNTY_ADMIN:
                regions = currentUser.region ? [currentUser.region] : [];
                counties = currentUser.county ? [currentUser.county] : [];
                subCounties = (formData.region && formData.county) ? Object.keys(geographicalData[formData.region][formData.county] || {}).sort() : [];
                regionLocked = true;
                countyLocked = true;
                break;
            case UserRole.SUB_COUNTY_ADMIN:
                regions = currentUser.region ? [currentUser.region] : [];
                counties = currentUser.county ? [currentUser.county] : [];
                subCounties = currentUser.subCounty ? [currentUser.subCounty] : [];
                regionLocked = true;
                countyLocked = true;
                subCountyLocked = true;
                break;
            default: 
                 counties = formData.region ? Object.keys(geographicalData[formData.region] || {}).sort() : [];
                 subCounties = (formData.region && formData.county) ? Object.keys(geographicalData[formData.region][formData.county] || {}).sort() : [];
        }

        return { 
            regionsForSelect: regions, 
            countiesForSelect: counties, 
            subCountiesForSelect: subCounties,
            isRegionLocked: regionLocked,
            isCountyLocked: countyLocked,
            isSubCountyLocked: subCountyLocked
        };
    }, [currentUser, geographicalData, formData.region, formData.county]);

    useEffect(() => {
        if (isOpen) {
            let initialData: Partial<User> = userToEdit || { roles: [], name: '', email: '' };

            if (!userToEdit && currentUser) {
                if (isRegionLocked) initialData.region = currentUser.region;
                if (isCountyLocked) initialData.county = currentUser.county;
                if (isSubCountyLocked) initialData.subCounty = currentUser.subCounty;

                switch (currentUser.currentRole) {
                    case UserRole.REGIONAL_ADMIN:
                        initialData.workRegion = currentUser.region;
                        initialData.workCounty = undefined;
                        initialData.workSubCounty = undefined;
                        break;
                    case UserRole.COUNTY_ADMIN:
                        initialData.workRegion = currentUser.region;
                        initialData.workCounty = currentUser.county;
                        initialData.workSubCounty = undefined;
                        break;
                    case UserRole.SUB_COUNTY_ADMIN:
                        initialData.workRegion = currentUser.region;
                        initialData.workCounty = currentUser.county;
                        initialData.workSubCounty = currentUser.subCounty;
                        break;
                    default: 
                        initialData.workRegion = undefined;
                        initialData.workCounty = undefined;
                        initialData.workSubCounty = undefined;
                        break;
                }
            }

            setFormData(initialData);
            setValidationError('');
        }
    }, [isOpen, userToEdit, currentUser, isRegionLocked, isCountyLocked, isSubCountyLocked]);
    
    // --- NEW: Debounced search effect ---
    useEffect(() => {
        if (userToEdit) return; // Don't search if we are editing from the main list

        const searchField = activeSuggestionField;
        const searchTerm = searchField ? String(formData[searchField] || '').trim() : '';

        if (!searchField || searchTerm.length < 3) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(() => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const matches = users.filter(u => {
                const value = u[searchField];
                return value && String(value).toLowerCase().includes(lowerCaseSearchTerm);
            });
            setSuggestions(matches);
        }, 300);

        return () => clearTimeout(timer);
    }, [formData.email, formData.tscNumber, formData.idNumber, userToEdit, users, activeSuggestionField]);

    // --- NEW: Click outside handler for suggestions ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setSuggestions([]);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (formData?.workRegion) {
            setWorkCountiesForSelect(Object.keys(geographicalData[formData.workRegion] || {}).sort());
        } else {
            setWorkCountiesForSelect([]);
        }
    }, [formData?.workRegion, geographicalData]);

    useEffect(() => {
        if (formData?.workRegion && formData?.workCounty) {
            setWorkSubCountiesForSelect(Object.keys(geographicalData[formData.workRegion]?.[formData.workCounty] || {}).sort());
        } else {
            setWorkSubCountiesForSelect([]);
        }
    }, [formData?.workRegion, formData?.workCounty, geographicalData]);

    // --- NEW: Handler for selecting a suggested user ---
    const handleSuggestionClick = (suggestedUser: User) => {
        const currentRolesInForm = new Set(formData.roles || []);
        const existingRoles = new Set(suggestedUser.roles);
        const mergedRoles = new Set([...existingRoles, ...currentRolesInForm]);

        setFormData({
            ...suggestedUser,
            roles: Array.from(mergedRoles)
        });
        setSuggestions([]);
        setActiveSuggestionField(null);
        showNotification(`Selected existing user: ${suggestedUser.name}. Their data has been filled. New roles will be added upon saving.`, 'info', 5000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let newState = { ...prev, [name]: value };
            if (name === 'region') {
                newState = { ...newState, county: '', subCounty: '' };
            } else if (name === 'county') {
                newState = { ...newState, subCounty: '' };
            } else if (name === 'workRegion') {
                newState = { ...newState, workCounty: '', workSubCounty: '' };
            } else if (name === 'workCounty') {
                newState = { ...newState, workSubCounty: '' };
            }
            return newState;
        });
    };

    const handleRoleChange = (role: UserRole, isChecked: boolean) => {
        setFormData(prev => {
            if (!prev) return null; 
            const currentRoles = prev.roles || [];
            let newRoles = isChecked
                ? [...currentRoles, role]
                : currentRoles.filter(r => r !== role);
            
            // --- NEW: Enforce mutual exclusivity ---
            if (isChecked) {
                if (role === UserRole.COORDINATOR) {
                    newRoles = newRoles.filter(r => r !== UserRole.JUDGE);
                } else if (role === UserRole.JUDGE) {
                    newRoles = newRoles.filter(r => r !== UserRole.COORDINATOR);
                }
            }
            // --- END NEW ---

            return { ...prev, roles: newRoles };
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (validationError) return;

        if (!formData.name || !formData.email || !formData.roles || formData.roles.length === 0) {
             setValidationError('Name, email, and at least one role are required.');
            return;
        }
        
        const isDuplicateEmail = users.some(u => u.email.toLowerCase() === formData.email?.toLowerCase() && u.id !== (formData.id || userToEdit?.id));
        if(isDuplicateEmail) {
            setValidationError('An account with this email already exists.');
            return;
        }

        const userPayload = { ...formData, name: toTitleCase(formData.name || '') };

        const hasJudgeRole = (userPayload.roles || []).some(r => JUDGE_ROLES.includes(r));
        if (!hasJudgeRole) {
            // If the user is not a judge/coordinator, their work jurisdiction is not applicable.
            userPayload.workRegion = undefined;
            userPayload.workCounty = undefined;
            userPayload.workSubCounty = undefined;
        }

        if (userToEdit || formData.id) { // Check if we're editing an existing user
            updateUserInList(userPayload as User);
        } else {
            addUserToList(userPayload as Omit<User, 'id'>);
        }
        onClose();
    };
    
    if (!currentUser) return null;
    
    const showPersonalGeoFields = formData.roles && formData.roles.some(r => r !== UserRole.NATIONAL_ADMIN && r !== UserRole.SUPER_ADMIN);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={userToEdit ? `Edit User: ${userToEdit.name}` : 'Add New User'} size="xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                {validationError && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 rounded-md text-red-700 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <p>{validationError}</p>
                    </div>
                )}

                <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                    <legend className="px-2 font-semibold text-lg">User Details</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1">Full Name</label>
                            <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative">
                            <label htmlFor="email" className="block text-sm font-medium mb-1">Email Address</label>
                            <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange} required disabled={!!(userToEdit || formData.id)} onFocus={() => setActiveSuggestionField('email')} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800" />
                            {activeSuggestionField === 'email' && suggestions.length > 0 && (
                                <ul ref={suggestionRef} className="absolute z-20 w-full mt-1 bg-card-light dark:bg-card-dark border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {suggestions.map(s => <li key={s.id} onClick={() => handleSuggestionClick(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">{s.name} ({s.email})</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                </fieldset>
                
                {isJudgeOrCoordinatorOrPatron && !(userToEdit || formData.id) && (
                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg">Additional Identifiers (for reactivation)</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <label htmlFor="tscNumber" className="block text-sm font-medium mb-1">TSC/Service Number</label>
                                <input type="text" name="tscNumber" id="tscNumber" value={formData.tscNumber || ''} onChange={handleChange} onFocus={() => setActiveSuggestionField('tscNumber')} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600" />
                                 {activeSuggestionField === 'tscNumber' && suggestions.length > 0 && (
                                    <ul ref={suggestionRef} className="absolute z-20 w-full mt-1 bg-card-light dark:bg-card-dark border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {suggestions.map(s => <li key={s.id} onClick={() => handleSuggestionClick(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">{s.name} ({s.tscNumber})</li>)}
                                    </ul>
                                )}
                            </div>
                            <div className="relative">
                                <label htmlFor="idNumber" className="block text-sm font-medium mb-1">National ID Number</label>
                                <input type="text" name="idNumber" id="idNumber" value={formData.idNumber || ''} onChange={handleChange} onFocus={() => setActiveSuggestionField('idNumber')} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600" />
                                {activeSuggestionField === 'idNumber' && suggestions.length > 0 && (
                                    <ul ref={suggestionRef} className="absolute z-20 w-full mt-1 bg-card-light dark:bg-card-dark border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {suggestions.map(s => <li key={s.id} onClick={() => handleSuggestionClick(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">{s.name} ({s.idNumber})</li>)}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </fieldset>
                )}


                <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                    <legend className="px-2 font-semibold text-lg">Roles</legend>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {creatableRoles.map(role => (
                            <div key={role} className="flex items-center gap-2">
                                <input type="checkbox" id={`role-${role}`} checked={formData.roles?.includes(role)} onChange={e => handleRoleChange(role, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                <label htmlFor={`role-${role}`} className="text-sm">{role}</label>
                            </div>
                        ))}
                    </div>
                </fieldset>

                {showPersonalGeoFields && (
                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg">Personal Geographical Scope</legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="region" className="block text-sm font-medium mb-1">Region</label>
                                <select name="region" id="region" value={formData.region || ''} onChange={handleChange} disabled={isRegionLocked} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70">
                                    <option value="">-- Select Region --</option>
                                    {regionsForSelect.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="county" className="block text-sm font-medium mb-1">County</label>
                                <select name="county" id="county" value={formData.county || ''} onChange={handleChange} disabled={isCountyLocked || !formData.region} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70">
                                    <option value="">-- Select County --</option>
                                    {countiesForSelect.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="subCounty" className="block text-sm font-medium mb-1">Sub-County</label>
                                <select name="subCounty" id="subCounty" value={formData.subCounty || ''} onChange={handleChange} disabled={isSubCountyLocked || !formData.county} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70">
                                    <option value="">-- Select Sub-County --</option>
                                    {subCountiesForSelect.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                </select>
                            </div>
                        </div>
                    </fieldset>
                )}
                
                {showWorkGeoFields && (
                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg flex items-center gap-2">
                            Work Jurisdiction <span title="This defines the geographical area this judge/coordinator can be assigned to."><Info size={14}/></span>
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div>
                                <label htmlFor="workRegion" className="block text-sm font-medium mb-1">Work Region</label>
                                <select name="workRegion" id="workRegion" value={formData.workRegion || ''} onChange={handleChange} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600">
                                    <option value="">-- Select Region --</option>
                                    {Object.keys(geographicalData).sort().map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="workCounty" className="block text-sm font-medium mb-1">Work County</label>
                                <select name="workCounty" id="workCounty" value={formData.workCounty || ''} onChange={handleChange} disabled={!formData.workRegion} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70">
                                    <option value="">-- Select County --</option>
                                    {workCountiesForSelect.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="workSubCounty" className="block text-sm font-medium mb-1">Work Sub-County</label>
                                <select name="workSubCounty" id="workSubCounty" value={formData.workSubCounty || ''} onChange={handleChange} disabled={!formData.workCounty} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70">
                                    <option value="">-- Select Sub-County --</option>
                                    {workSubCountiesForSelect.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                </select>
                            </div>
                        </div>
                    </fieldset>
                )}


                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={!!validationError}>
                        {userToEdit || formData.id ? 'Save Changes' : 'Create User'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export const UserManagementPage: React.FC = () => {
    const { user: currentUser, users, deleteUserFromList, bulkDeleteUsers, projects, assignments, viewingLevel, overallHighestLevel } = useContext(AppContext);
    const location = useLocation();
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isBulkOpsModalOpen, setIsBulkOpsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);
    const [isAssignmentsModalOpen, setIsAssignmentsModalOpen] = useState(false);
    const [isViewProfileModalOpen, setIsViewProfileModalOpen] = useState(false);
    const [userToManage, setUserToManage] = useState<User | null>(null);
    const [confirmDeleteState, setConfirmDeleteState] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
    const [confirmBulkDeleteState, setConfirmBulkDeleteState] = useState<{ isOpen: boolean; users: User[] }>({ isOpen: false, users: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [judgeFilter, setJudgeFilter] = useState<'all' | 'active'>('all');
    const [selectedUsers, setSelectedUsers] = useState(new Set<string>());
    const tableContainerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const filter = queryParams.get('filter');
        if (filter) {
            if (filter === 'JUDGES') {
                setRoleFilter('JUDGES');
                setJudgeFilter('active');
            } else if (['ALL', 'ADMINS', 'PATRONS'].includes(filter)) {
                setRoleFilter(filter);
                setJudgeFilter('all');
            }
        }
    }, [location.search]);

    const canManageAssignments = useMemo(() => {
        if (!currentUser) return false;
    
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const isViewingPastLevel = levelOrder.indexOf(viewingLevel) < levelOrder.indexOf(overallHighestLevel);
        if (isViewingPastLevel) return false;
        
        if (currentUser.currentRole === UserRole.SUPER_ADMIN) return true;
    
        const roleToLevelMap: { [key in UserRole]?: CompetitionLevel } = {
            [UserRole.SUB_COUNTY_ADMIN]: CompetitionLevel.SUB_COUNTY,
            [UserRole.COUNTY_ADMIN]: CompetitionLevel.COUNTY,
            [UserRole.REGIONAL_ADMIN]: CompetitionLevel.REGIONAL,
            [UserRole.NATIONAL_ADMIN]: CompetitionLevel.NATIONAL,
        };
        
        const expectedLevel = roleToLevelMap[currentUser.currentRole];
        return expectedLevel === viewingLevel;
    
    }, [currentUser, viewingLevel, overallHighestLevel]);

    const activeJudgeIdsForLevel = useMemo(() => {
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const isViewingPastLevel = levelOrder.indexOf(viewingLevel) < levelOrder.indexOf(overallHighestLevel);
        if (isViewingPastLevel) {
            // No judges are "active" for a level that is already completed.
            return new Set<string>();
        }
        
        // A judge is active for a level if they have at least one non-archived assignment for that specific level.
        const assignmentsForThisLevel = assignments.filter(a => a.competitionLevel === viewingLevel && !a.isArchived);
        
        // Collect the unique judge IDs from those assignments.
        return new Set(assignmentsForThisLevel.map(a => a.judgeId));
        
    }, [assignments, viewingLevel, overallHighestLevel]);

    const filteredUsers = useMemo(() => {
        if (!currentUser) return [];

        // Define which projects are part of the current viewing level's cohort
        const levelOrder = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];
        const viewingLevelIndex = levelOrder.indexOf(viewingLevel);
        const projectsParticipatingInLevel = projects.filter(p => levelOrder.indexOf(p.currentLevel) >= viewingLevelIndex);

        // From those projects, get the set of patron IDs
        const activePatronIds = new Set<string>();
        projectsParticipatingInLevel.forEach(p => {
            if (p.patronId) activePatronIds.add(p.patronId);
        });

        if (currentUser.currentRole === UserRole.SUPER_ADMIN) {
            return users
                .filter(u => u.id !== currentUser.id)
                .filter(u => {
                    const search = searchTerm.toLowerCase();
                    const matchesSearch = u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
                    if (!matchesSearch) return false;
                    switch (roleFilter) {
                        case 'ADMINS': return u.roles.some(r => ADMIN_ROLES.includes(r));
                        case 'JUDGES':
                             if (!u.roles.some(r => JUDGE_ROLES.includes(r))) return false;
                             if (judgeFilter === 'all') return true;
                             return activeJudgeIdsForLevel.has(u.id);
                        case 'PATRONS': return u.roles.includes(UserRole.PATRON) && activePatronIds.has(u.id);
                        default: return true;
                    }
                })
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        const currentUserLevel = ROLE_HIERARCHY_MAP[currentUser.currentRole];

        return users
            .filter(u => {
                if (u.id === currentUser.id) return false;

                const userHighestRoleLevel = Math.min(...u.roles.map(r => ROLE_HIERARCHY_MAP[r]));
                if (userHighestRoleLevel < currentUserLevel) {
                    return false;
                }
                
                const search = searchTerm.toLowerCase();
                const matchesSearch = u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
                if (!matchesSearch) return false;

                const targetUserWorkRegion = u.workRegion || u.region;
                const targetUserWorkCounty = u.workCounty || u.county;
                const targetUserWorkSubCounty = u.workSubCounty || u.subCounty;

                let isInGeoScope = false;
                switch (currentUser.currentRole) {
                    case UserRole.REGIONAL_ADMIN:
                        isInGeoScope = targetUserWorkRegion === currentUser.region;
                        break;
                    case UserRole.COUNTY_ADMIN:
                        isInGeoScope = targetUserWorkCounty === currentUser.county && targetUserWorkRegion === currentUser.region;
                        break;
                    case UserRole.SUB_COUNTY_ADMIN:
                        isInGeoScope = targetUserWorkSubCounty === currentUser.subCounty && targetUserWorkCounty === currentUser.county && targetUserWorkRegion === currentUser.region;
                        break;
                    default: 
                        isInGeoScope = true;
                        break;
                }
                if (!isInGeoScope) return false;

                const isAnActiveAdmin = u.roles.some(r => ADMIN_ROLES.includes(r));
                const isAnEligibleJudge = u.roles.some(r => JUDGE_ROLES.includes(r));
                const isAnActivePatron = u.roles.includes(UserRole.PATRON) && activePatronIds.has(u.id);

                switch (roleFilter) {
                    case 'ADMINS':
                        return isAnActiveAdmin;
                    case 'JUDGES':
                        if (!isAnEligibleJudge) return false;
                        if (judgeFilter === 'all') return true;
                        if (judgeFilter === 'active') return activeJudgeIdsForLevel.has(u.id);
                        return false;
                    case 'PATRONS':
                        return isAnActivePatron;
                    case 'ALL':
                    default:
                        return isAnActiveAdmin || isAnEligibleJudge || isAnActivePatron;
                }
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, currentUser, searchTerm, roleFilter, projects, viewingLevel, assignments, judgeFilter, activeJudgeIdsForLevel]);
    
    const usersWithDetails = useMemo(() => {
        return filteredUsers.map(user => {
            const isJudgeOrCoordinator = user.roles.some(r => JUDGE_ROLES.includes(r));
            if (!isJudgeOrCoordinator) {
                return { user, assignmentsSummary: [], progress: { total: 0, completed: 0, percentage: 0 } };
            }
    
            // 1. Get assignments for this user at the current viewing level
            const assignmentsForLevel = assignments.filter(a => {
                if (a.judgeId !== user.id || a.isArchived) return false;
                // FIX: Removed project-level check; assignment level is sufficient and correct.
                return a.competitionLevel === viewingLevel;
            });
    
            // 2. Summarize assignments by category
            const summary = new Map<string, Set<string>>();
            for (const assignment of assignmentsForLevel) {
                const project = projects.find(p => p.id === assignment.projectId);
                if (project) { 
                    if (!summary.has(project.category)) {
                        summary.set(project.category, new Set());
                    }
                    summary.get(project.category)!.add(assignment.assignedSection);
                }
            }
            const assignmentsSummary = Array.from(summary.entries()).map(([category, sections]) => ({
                category,
                sections: Array.from(sections).sort()
            }));
    
            // 3. Calculate progress
            const total = assignmentsForLevel.length;
            const completed = assignmentsForLevel.filter(a => a.status === ProjectStatus.COMPLETED).length;
            const percentage = total > 0 ? (completed / total) * 100 : 0;
            
            return {
                user,
                assignmentsSummary,
                progress: { total, completed, percentage }
            };
        });
    }, [filteredUsers, assignments, projects, viewingLevel]);

    const isAllSelected = useMemo(() => {
        return filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length;
    }, [selectedUsers, filteredUsers]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredUsers.map(u => u.id));
            setSelectedUsers(allIds);
        } else {
            setSelectedUsers(new Set());
        }
    };
    
    const handleSelectUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleAddUser = () => {
        setUserToEdit(null);
        setIsAddEditModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setUserToEdit(user);
        setIsAddEditModalOpen(true);
    };
    
    const handleManageAssignments = (user: User) => {
        setUserToManage(user);
        setIsAssignmentsModalOpen(true);
    };

    const handleDeleteUser = (user: User) => {
        setConfirmDeleteState({ isOpen: true, user: user });
    };

    const handleConfirmDelete = () => {
        if (confirmDeleteState.user) {
            deleteUserFromList(confirmDeleteState.user.id);
        }
        setConfirmDeleteState({ isOpen: false, user: null });
    };
    
    const handleBulkDelete = () => {
        const usersToDelete = filteredUsers.filter(u => selectedUsers.has(u.id));
        setConfirmBulkDeleteState({ isOpen: true, users: usersToDelete });
    };

    const handleConfirmBulkDelete = () => {
        if (confirmBulkDeleteState.users.length > 0) {
            bulkDeleteUsers(confirmBulkDeleteState.users.map(u => u.id));
        }
        setConfirmBulkDeleteState({ isOpen: false, users: [] });
        setSelectedUsers(new Set());
    };
    
    const handleBulkRoleAssign = () => {
        setIsBulkRoleModalOpen(true);
    };

    const getRoleChipClass = (role: UserRole) => {
        switch(role) {
            case UserRole.SUPER_ADMIN: return "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200";
            case UserRole.NATIONAL_ADMIN: return "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200";
            case UserRole.REGIONAL_ADMIN: return "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200";
            case UserRole.COUNTY_ADMIN: return "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200";
            case UserRole.SUB_COUNTY_ADMIN: return "bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200";
            case UserRole.JUDGE: return "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200";
            case UserRole.COORDINATOR: return "bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-200";
            case UserRole.PATRON: return "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200";
            default: return "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200";
        }
    };
    
    const downloadUserListPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("KSEF User List", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Filter: ${roleFilter} | Generated on: ${new Date().toLocaleDateString()}`, 105, 26, { align: 'center' });

        const head = [['Name', 'Email', 'Roles', 'Area']];
        const body = filteredUsers.map(u => [
            u.name,
            u.email,
            u.roles.join(', '),
            [u.region, u.county, u.subCounty].filter(Boolean).join(' > ') || 'National'
        ]);

        (doc as any).autoTable({
            startY: 35,
            head,
            body,
            theme: 'grid',
        });
        
        doc.save('KSEF_User_List.pdf');
    };

    if (!currentUser) return null;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">User Management</h1>
            <CompetitionLevelSwitcher />
            <Card>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full max-w-sm p-2 pl-10 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                         <Button onClick={handleAddUser} className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4" /> Add User
                        </Button>
                        <Button variant="secondary" onClick={() => setIsBulkOpsModalOpen(true)} className="flex items-center gap-2">
                            <Users className="w-4 h-4" /> Bulk Operations
                        </Button>
                    </div>
                </div>

                <div className="flex border-b border-gray-200 dark:border-gray-700 mt-6">
                    <button onClick={() => { setRoleFilter('ALL'); setJudgeFilter('all'); }} className={`px-4 py-2 font-semibold ${roleFilter === 'ALL' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}>All Users</button>
                    <button onClick={() => { setRoleFilter('ADMINS'); setJudgeFilter('all'); }} className={`px-4 py-2 font-semibold ${roleFilter === 'ADMINS' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}>Administrators</button>
                    <button onClick={() => { setRoleFilter('JUDGES'); setJudgeFilter('active'); }} className={`px-4 py-2 font-semibold ${roleFilter === 'JUDGES' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}>Judges & Coordinators</button>
                    <button onClick={() => { setRoleFilter('PATRONS'); setJudgeFilter('all'); }} className={`px-4 py-2 font-semibold ${roleFilter === 'PATRONS' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}>Patrons</button>
                </div>

                {roleFilter === 'JUDGES' && (
                    <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg p-1 mt-4 max-w-sm">
                        <Button
                            variant={judgeFilter === 'all' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setJudgeFilter('all')}
                            className="w-1/2"
                        >
                            All In Scope
                        </Button>
                        <Button
                            variant={judgeFilter === 'active' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setJudgeFilter('active')}
                            className="w-1/2"
                        >
                            Active for Level
                        </Button>
                    </div>
                )}

                {selectedUsers.size > 0 && (
                    <div className="p-3 bg-primary/10 rounded-lg mt-4 flex flex-wrap items-center justify-between gap-4">
                        <p className="font-semibold text-primary">{selectedUsers.size} user(s) selected</p>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={handleBulkRoleAssign}>Assign Roles</Button>
                            <Button size="sm" onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete Selected</Button>
                        </div>
                    </div>
                )}
            </Card>

            <div ref={tableContainerRef} className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3 w-4"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded" /></th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Roles</th>
                            <th className="px-4 py-3">School / Assignment</th>
                            {roleFilter === 'JUDGES' && judgeFilter === 'active' && (
                                <th className="px-4 py-3">Judging Progress</th>
                            )}
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usersWithDetails.map(({ user, assignmentsSummary, progress }) => (
                            <tr key={user.id} className="border-b dark:border-gray-700 text-text-light dark:text-text-dark">
                                <td className="px-4 py-3"><input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => handleSelectUser(user.id)} className="rounded" /></td>
                                <td className="px-4 py-3 font-medium">{user.name}</td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3">
                                    {user.forcePasswordChange ? (
                                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs py-1 px-2 rounded-full bg-amber-100 dark:bg-amber-900/30" title="User has not logged in to set their password yet.">
                                            <Clock className="w-4 h-4" /> Pending Setup
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold text-xs py-1 px-2 rounded-full bg-green-100 dark:bg-green-900/30" title="User is active.">
                                            <CheckCircle className="w-4 h-4" /> Active
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles.map(role => (
                                            <span key={role} className={`text-xs font-semibold px-2 py-1 rounded-full ${getRoleChipClass(role)}`}>{role}</span>
                                        ))}
                                    </div>
                                </td>
                                 <td className="px-4 py-3">
                                    <div className="flex flex-col gap-2">
                                        {user.school && <p className="font-semibold text-sm text-text-light dark:text-text-dark">{user.school}</p>}
                                        {assignmentsSummary.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {assignmentsSummary.map(({ category, sections }) => 
                                                    sections.map(section => (
                                                        <span key={`${category}-${section}`} className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                                                            {category} {section.replace('Part ', '')}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                        {!user.school && assignmentsSummary.length === 0 && (
                                            <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                                {[user.subCounty, user.county, user.region].filter(Boolean).join(', ') || 'National'}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                {roleFilter === 'JUDGES' && judgeFilter === 'active' && (
                                    <td className="px-4 py-3">
                                        {progress.total > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress.percentage}%` }}></div>
                                                </div>
                                                <span className="text-xs font-mono w-14 text-right">{progress.completed}/{progress.total}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-text-muted-light dark:text-text-muted-dark italic">No assignments</span>
                                        )}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-center">
                                     <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => { setUserToManage(user); setIsViewProfileModalOpen(true); }} title="View Profile" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><Eye className="w-4 h-4 text-primary"/></button>
                                        <button onClick={() => handleEditUser(user)} title="Edit User" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><Edit className="w-4 h-4 text-blue-500"/></button>
                                        {(user.roles.includes(UserRole.JUDGE) || user.roles.includes(UserRole.COORDINATOR)) && (
                                            <button onClick={() => handleManageAssignments(user)} title={canManageAssignments ? "Manage Assignments" : "You can only manage assignments for your specific competition level."} disabled={!canManageAssignments} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"><Settings className="w-4 h-4 text-green-500" /></button>
                                        )}
                                        <button onClick={() => handleDeleteUser(user)} title="Delete User" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {usersWithDetails.length === 0 && (
                    <div className="text-center py-10 text-text-muted-light dark:text-text-muted-dark">
                        <p>No users match the current filters.</p>
                    </div>
                )}
            </div>
            {filteredUsers.length > 0 && (
                <div className="flex justify-end mt-4">
                     <Button variant="secondary" onClick={downloadUserListPDF} className="flex items-center gap-2">
                        <FileDown className="w-4 h-4" /> Download List (PDF)
                    </Button>
                </div>
            )}

            {isAddEditModalOpen && <AddEditUserModal isOpen={isAddEditModalOpen} onClose={() => setIsAddEditModalOpen(false)} userToEdit={userToEdit} />}
            {isBulkOpsModalOpen && <BulkOperationsModal isOpen={isBulkOpsModalOpen} onClose={() => setIsBulkOpsModalOpen(false)} />}
            {isBulkRoleModalOpen && <BulkRoleAssignModal isOpen={isBulkRoleModalOpen} onClose={() => { setIsBulkRoleModalOpen(false); setSelectedUsers(new Set()); }} userIds={Array.from(selectedUsers)} />}
            {isAssignmentsModalOpen && userToManage && <JudgeCategoryAssignmentModal isOpen={isAssignmentsModalOpen} onClose={() => setIsAssignmentsModalOpen(false)} judge={userToManage} />}
            {isViewProfileModalOpen && userToManage && <ViewUserProfileModal isOpen={isViewProfileModalOpen} onClose={() => setIsViewProfileModalOpen(false)} user={userToManage} />}

            {confirmDeleteState.isOpen && (
                <ConfirmationModal
                    isOpen={confirmDeleteState.isOpen}
                    onClose={() => setConfirmDeleteState({ isOpen: false, user: null })}
                    onConfirm={handleConfirmDelete}
                    title={`Delete User: ${confirmDeleteState.user?.name}`}
                >
                    Are you sure you want to permanently delete this user? This action cannot be undone.
                </ConfirmationModal>
            )}
            {confirmBulkDeleteState.isOpen && (
                <ConfirmationModal
                    isOpen={confirmBulkDeleteState.isOpen}
                    onClose={() => setConfirmBulkDeleteState({ isOpen: false, users: [] })}
                    onConfirm={handleConfirmBulkDelete}
                    title={`Delete ${confirmBulkDeleteState.users.length} Users`}
                >
                    Are you sure you want to permanently delete the selected users? This action cannot be undone.
                </ConfirmationModal>
            )}
        </div>
    );
};
