import React, { useState, useContext, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { CheckCircle, XCircle, Loader, FileText } from 'lucide-react';

type ParsedAdmin = Omit<User, 'id'> & {
    status: 'valid' | 'invalid';
    error?: string;
};

const ADMIN_ROLES = [
    UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
    UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN
];

// Helper from UserManagementPage to check permissions
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

// Helper function to format strings to Title Case
const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const BulkAddAdminsModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { user: currentUser, geographicalData, addMultipleUsers, showNotification } = useContext(AppContext);
    const [csvData, setCsvData] = useState('');
    const [parsedUsers, setParsedUsers] = useState<ParsedAdmin[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [targetRole, setTargetRole] = useState<UserRole | ''>('');

    const creatableAdminRoles = useMemo(() => {
        if (!currentUser) return [];
        return getCreatableRoles(currentUser.currentRole).filter(r => ADMIN_ROLES.includes(r));
    }, [currentUser]);

    const formatDetails = useMemo(() => {
        if (!targetRole || !currentUser) return { format: '', placeholder: '', columns: 0 };

        switch (targetRole) {
            case UserRole.REGIONAL_ADMIN:
                return { format: 'Name,Email,Region', placeholder: 'Susan Njeri,central.admin@ksef.org,Central', columns: 3 };
            case UserRole.COUNTY_ADMIN:
                if (currentUser.currentRole === UserRole.REGIONAL_ADMIN) {
                    return { format: 'Name,Email,County', placeholder: 'Peter Kamau,kiambu.admin@ksef.org,Kiambu', columns: 3 };
                }
                return { format: 'Name,Email,Region,County', placeholder: 'Peter Kamau,kiambu.admin@ksef.org,Central,Kiambu', columns: 4 };
            case UserRole.SUB_COUNTY_ADMIN:
                if (currentUser.currentRole === UserRole.COUNTY_ADMIN) {
                    return { format: 'Name,Email,Sub-County', placeholder: 'James Mwangi,gatundu.admin@ksef.org,Gatundu South', columns: 3 };
                }
                return { format: 'Name,Email,Region,County,Sub-County', placeholder: 'James Mwangi,gatundu.admin@ksef.org,Central,Kiambu,Gatundu South', columns: 5 };
            default:
                return { format: '', placeholder: '', columns: 0 };
        }
    }, [targetRole, currentUser]);

    const validUsers = useMemo(() => parsedUsers.filter(u => u.status === 'valid'), [parsedUsers]);

    const handleParse = () => {
        if (!currentUser || !targetRole) return;
        setIsLoading(true);
        const lines = csvData.trim().split('\n');
        // FIX: Add explicit return type `ParsedAdmin | null` to the map function to ensure correct type inference for `results`.
        const results = lines.map((line): ParsedAdmin | null => {
            if (!line.trim()) return null;
            const parts = line.split(',').map(s => s ? s.trim() : '');
            let error = '';
            
            const baseUser: Omit<User, 'id'> = { name: '', email: '', roles: [targetRole], currentRole: targetRole };

            if (parts.length < formatDetails.columns) {
                error = `Invalid number of columns. Expected ${formatDetails.columns}.`;
            } else {
                // Simplified logic using the formatDetails
                switch (targetRole) {
                    case UserRole.REGIONAL_ADMIN:
                        baseUser.name = toTitleCase(parts[0]);
                        [ , baseUser.email, baseUser.region] = parts;
                        break;
                    case UserRole.COUNTY_ADMIN:
                        baseUser.name = toTitleCase(parts[0]);
                        if (currentUser.currentRole === UserRole.REGIONAL_ADMIN) {
                            [ , baseUser.email, baseUser.county] = parts;
                            baseUser.region = currentUser.region;
                        } else {
                            [ , baseUser.email, baseUser.region, baseUser.county] = parts;
                        }
                        break;
                    case UserRole.SUB_COUNTY_ADMIN:
                        baseUser.name = toTitleCase(parts[0]);
                         if (currentUser.currentRole === UserRole.COUNTY_ADMIN) {
                            [ , baseUser.email, baseUser.subCounty] = parts;
                            baseUser.county = currentUser.county;
                            baseUser.region = currentUser.region;
                        } else {
                            [ , baseUser.email, baseUser.region, baseUser.county, baseUser.subCounty] = parts;
                        }
                        break;
                }
            }

            // Centralized Validation
            if (!error) {
                if (!baseUser.name || !baseUser.email) {
                    error = 'Missing required fields (Name, Email).';
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(baseUser.email)) {
                    error = 'Invalid email format.';
                } else {
                    // Geo validation
                    if (baseUser.region && !geographicalData[baseUser.region]) {
                        error = `Region '${baseUser.region}' not found.`;
                    } else if (baseUser.county && !geographicalData[baseUser.region!]?.[baseUser.county]) {
                         error = `County '${baseUser.county}' not found in '${baseUser.region}'.`;
                    } else if (baseUser.subCounty && !geographicalData[baseUser.region!]?.[baseUser.county!]?.[baseUser.subCounty]) {
                        error = `Sub-County '${baseUser.subCounty}' not found in '${baseUser.county}'.`;
                    }
                }
            }
            
            // Set work jurisdiction to match personal jurisdiction for new admins
            baseUser.workRegion = baseUser.region;
            baseUser.workCounty = baseUser.county;
            baseUser.workSubCounty = baseUser.subCounty;

            // FIX: Explicitly type `status` to satisfy the `ParsedAdmin` type.
            const status: 'valid' | 'invalid' = error ? 'invalid' : 'valid';

            return {
                ...baseUser,
                status,
                error: error || undefined,
            };
        // FIX: Correctly type-guard the filter to remove nulls, resolving the type predicate error.
        }).filter((u): u is ParsedAdmin => u !== null);
        
        setTimeout(() => {
            setParsedUsers(results);
            setIsLoading(false);
        }, 500);
    };

    const handleConfirmAdd = () => {
        if (validUsers.length === 0) return;
        const newUsers: Omit<User, 'id'>[] = validUsers.map(({ status, error, ...user }) => user);
        addMultipleUsers(newUsers);
        handleClose();
    };

    const handleClose = () => {
        setCsvData('');
        setParsedUsers([]);
        setIsLoading(false);
        setTargetRole('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Add Administrators" size="xl">
            <div className="space-y-4">
                <div>
                    <label htmlFor="role-select" className="block mb-1 font-medium text-text-light dark:text-text-dark">
                        Step 1: Select Role to Add
                    </label>
                    <select
                        id="role-select"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value as UserRole)}
                        className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary"
                    >
                        <option value="" disabled>-- Select an Admin Role --</option>
                        {creatableAdminRoles.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                </div>
                
                {targetRole && (
                    <div className="border-t dark:border-gray-700 pt-4 space-y-4">
                        <div>
                            <label htmlFor="csv-data" className="block mb-1 font-medium text-text-light dark:text-text-dark">
                                Step 2: Paste Admin Data
                            </label>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-2">
                                Use the format: <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded-md text-xs">{formatDetails.format}</code>
                            </p>
                            <textarea
                                id="csv-data"
                                rows={8}
                                value={csvData}
                                onChange={e => setCsvData(e.target.value)}
                                placeholder={formatDetails.placeholder}
                                className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary"
                            />
                        </div>
                        <Button onClick={handleParse} disabled={isLoading || !csvData.trim()} className="w-full flex items-center justify-center gap-2">
                            {isLoading ? <><Loader className="w-4 h-4 animate-spin" /> Parsing...</> : <><FileText className="w-4 h-4" /> Parse & Preview</>}
                        </Button>
                    </div>
                )}


                {parsedUsers.length > 0 && (
                    <div className="border-t dark:border-gray-700 pt-4">
                        <h3 className="font-semibold mb-2 text-text-light dark:text-text-dark">{parsedUsers.length} Rows Found ({validUsers.length} valid)</h3>
                        <div className="overflow-y-auto max-h-60 border dark:border-gray-700 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark">
                                    <tr>
                                        <th className="px-2 py-2 text-left">Status</th>
                                        <th className="px-2 py-2 text-left">Name</th>
                                        <th className="px-2 py-2 text-left">Email</th>
                                        <th className="px-2 py-2 text-left">Roles</th>
                                        <th className="px-2 py-2 text-left">Area</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedUsers.map((user, index) => (
                                        <tr key={index} className={`border-t dark:border-gray-700 ${user.status === 'invalid' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                            <td className="px-2 py-2">
                                                {user.status === 'valid' 
                                                    ? <CheckCircle className="w-5 h-5 text-green-500"><title>Valid</title></CheckCircle>
                                                    : <XCircle className="w-5 h-5 text-red-500"><title>{user.error}</title></XCircle>
                                                }
                                            </td>
                                            <td className="px-2 py-2">{user.name || <i className="text-gray-400">N/A</i>}</td>
                                            <td className="px-2 py-2">{user.email || <i className="text-gray-400">N/A</i>}</td>
                                            <td className="px-2 py-2">{user.roles.join(', ') || <i className="text-gray-400">N/A</i>}</td>
                                            <td className="px-2 py-2 text-xs">{[user.region, user.county, user.subCounty].filter(Boolean).join(' > ') || <i className="text-gray-400">N/A</i>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                    <Button type="button" onClick={handleConfirmAdd} disabled={validUsers.length === 0}>
                        Add {validUsers.length} Valid Admins
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default BulkAddAdminsModal;