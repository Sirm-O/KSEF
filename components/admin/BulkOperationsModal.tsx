import React, { useState, useContext, useMemo, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { CheckCircle, XCircle, Loader, FileText, Download, Upload, UserCheck, UserPlus } from 'lucide-react';

type ParsedUser = {
    data: { [key: string]: string };
    status: 'valid-create' | 'valid-update' | 'invalid';
    error?: string;
    finalUser?: Omit<User, 'id'>;
    existingUser?: User;
};

const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const ADMIN_ROLES = [
    UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
    UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN
];

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


const BulkOperationsModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { user: currentUser, users, geographicalData, bulkCreateOrUpdateUsers, bulkTaskProgress, isPerformingBackgroundTask } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<'judges' | 'admins'>('judges');
    const [file, setFile] = useState<File | null>(null);
    const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [localProgress, setLocalProgress] = useState<{ current: number; total: number; task: string } | null>(null);
    const [adminRoleToCreate, setAdminRoleToCreate] = useState<UserRole | ''>('');

    const creatableAdminRoles = useMemo(() => {
        if (!currentUser) return [];
        return getCreatableRoles(currentUser.currentRole).filter(r => ADMIN_ROLES.includes(r));
    }, [currentUser]);

    const headers = useMemo(() => {
        const optionalHeaders = ['TSC Number (Optional)', 'ID Number (Optional)'];
        if (activeTab === 'judges') {
            return ['Name', 'Email', 'Phone Number', 'Role', ...optionalHeaders];
        }
        if (activeTab === 'admins') {
            if (!adminRoleToCreate || !currentUser) return [];
            const base = ['Name', 'Email', 'Phone Number'];
            switch (adminRoleToCreate) {
                case UserRole.REGIONAL_ADMIN: return [...base, 'Region', ...optionalHeaders];
                case UserRole.COUNTY_ADMIN:
                    return currentUser.currentRole === UserRole.REGIONAL_ADMIN
                        ? [...base, 'County', ...optionalHeaders]
                        : [...base, 'Region', 'County', ...optionalHeaders];
                case UserRole.SUB_COUNTY_ADMIN:
                    return currentUser.currentRole === UserRole.COUNTY_ADMIN
                        ? [...base, 'Sub-County', ...optionalHeaders]
                        : [...base, 'Region', 'County', 'Sub-County', ...optionalHeaders];
                default: return [];
            }
        }
        return [];
    }, [activeTab, adminRoleToCreate, currentUser]);

    const validUsers = useMemo(() => parsedUsers.filter(u => u.status.startsWith('valid')), [parsedUsers]);

    const downloadTemplate = useCallback(() => {
        if (headers.length === 0) return;

        let exampleData: string[] = [];
        if (activeTab === 'judges') {
            exampleData = [
                'Dr. Jane Doe,jane.d@university.ac.ke,254712345678,Judge,123456,',
                'Prof. John Smith,j.smith@tum.ac.ke,254787654321,Coordinator,,23456789',
            ];
        } else if (activeTab === 'admins' && adminRoleToCreate && currentUser) {
            switch (adminRoleToCreate) {
                case UserRole.REGIONAL_ADMIN:
                    exampleData = ['Susan Njeri,susan.njeri@ksef.org,254700000001,Central,,'];
                    break;
                case UserRole.COUNTY_ADMIN:
                    if (currentUser.currentRole === UserRole.REGIONAL_ADMIN) {
                        exampleData = ['Peter Kamau,peter.kamau@ksef.org,254700000002,Kiambu,,'];
                    } else {
                        exampleData = ['Peter Kamau,peter.kamau@ksef.org,254700000002,Central,Kiambu,,'];
                    }
                    break;
                case UserRole.SUB_COUNTY_ADMIN:
                    if (currentUser.currentRole === UserRole.COUNTY_ADMIN) {
                        exampleData = ['James Mwangi,james.mwangi@ksef.org,254700000003,Gatundu South,,'];
                    } else {
                        exampleData = ['James Mwangi,james.mwangi@ksef.org,254700000003,Central,Kiambu,Gatundu South,,'];
                    }
                    break;
            }
        }

        const csvHeader = headers.join(',');
        const csvExamples = exampleData.join('\n');
        const csvContent = `${csvHeader}\n${csvExamples}`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const filename = activeTab === 'judges' ? 'judges_coordinators_template.csv' : `admins_${adminRoleToCreate.replace(' ', '_')}_template.csv`;
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [headers, activeTab, adminRoleToCreate, currentUser]);

    const parseCSV = useCallback((csvText: string) => {
        if (!currentUser) return;
        setIsLoading(true);
        const lines = csvText.trim().split('\n');
        const fileHeadersLine = lines.shift()?.trim();

        if (!fileHeadersLine) {
            setIsLoading(false);
            setParsedUsers([]);
            return;
        }

        const fileHeaders = fileHeadersLine.split(',').map(h => h.trim());

        if (JSON.stringify(fileHeaders.map(h => h.toLowerCase())) !== JSON.stringify(headers.map(h => h.toLowerCase()))) {
            alert(`Invalid CSV headers. Expected: ${headers.join(',')}. Found: ${fileHeaders.join(',')}`);
            setIsLoading(false);
            setFile(null);
            return;
        }

        const results = lines.map((line): ParsedUser | null => {
            if (!line.trim() || line.startsWith('#')) return null;
            const values = line.split(',').map(s => s.trim());
            const data: { [key: string]: string } = {};
            headers.forEach((h, i) => data[h] = values[i] || '');

            let error = '';
            let status: ParsedUser['status'] = 'invalid';
            let finalUser: Omit<User, 'id'> | undefined = undefined;
            let existingUser: User | undefined = undefined;

            const email = data['Email']?.toLowerCase();
            const phoneNumber = data['Phone Number'];
            const name = toTitleCase(data['Name']);
            const tscNumber = data['TSC Number (Optional)'];
            const idNumber = data['ID Number (Optional)'];

            if (!name || !email || !phoneNumber) {
                error = 'Missing Name, Email, or Phone Number.';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                error = 'Invalid email format.';
            } else if (!/^\d{9,15}$/.test(phoneNumber.replace(/\+/g, ''))) {
                error = 'Invalid phone number (9-15 digits required).';
            } else {
                existingUser = users.find(u =>
                    u.email.toLowerCase() === email ||
                    (tscNumber && u.tscNumber && u.tscNumber === tscNumber) ||
                    (idNumber && u.idNumber && u.idNumber === idNumber)
                );

                if (existingUser) {
                    status = 'valid-update';
                    finalUser = { ...existingUser, phoneNumber }; // Start with existing data, update phone
                } else {
                    status = 'valid-create';
                    finalUser = { name, email, phoneNumber, roles: [], currentRole: UserRole.PATRON };
                }

                if (activeTab === 'judges') {
                    const roleStr = toTitleCase(data['Role']);
                    if (roleStr !== 'Judge' && roleStr !== 'Coordinator') {
                        error = "Role must be 'Judge' or 'Coordinator'.";
                    } else {
                        const role = roleStr as UserRole;
                        const newRoles = new Set(finalUser.roles);
                        newRoles.add(role);
                        if (role === UserRole.JUDGE) newRoles.delete(UserRole.COORDINATOR);
                        if (role === UserRole.COORDINATOR) newRoles.delete(UserRole.JUDGE);
                        finalUser.roles = Array.from(newRoles);

                        if (currentUser) {
                            // Apply jurisdiction rules based on admin's role
                            switch (currentUser.currentRole) {
                                case UserRole.REGIONAL_ADMIN:
                                    finalUser.workRegion = currentUser.region;
                                    finalUser.workCounty = undefined;
                                    finalUser.workSubCounty = undefined;
                                    break;
                                case UserRole.COUNTY_ADMIN:
                                    finalUser.workRegion = currentUser.region;
                                    finalUser.workCounty = currentUser.county;
                                    finalUser.workSubCounty = undefined;
                                    break;
                                case UserRole.SUB_COUNTY_ADMIN:
                                    finalUser.workRegion = currentUser.region;
                                    finalUser.workCounty = currentUser.county;
                                    finalUser.workSubCounty = currentUser.subCounty;
                                    break;
                            }
                            // Also set personal geo to match work geo by default for new judges for convenience.
                            finalUser.region = finalUser.workRegion;
                            finalUser.county = finalUser.workCounty;
                            finalUser.subCounty = finalUser.workSubCounty;
                        }
                    }
                } else if (activeTab === 'admins' && adminRoleToCreate) {
                    const newRoles = new Set(finalUser.roles);
                    newRoles.add(adminRoleToCreate);
                    finalUser.roles = Array.from(newRoles);

                    switch (adminRoleToCreate) {
                        case UserRole.REGIONAL_ADMIN:
                            finalUser.region = data['Region'];
                            if (!geographicalData[finalUser.region!]) error = `Region '${finalUser.region}' not found.`;
                            break;
                        case UserRole.COUNTY_ADMIN:
                            finalUser.region = currentUser.currentRole === UserRole.REGIONAL_ADMIN ? currentUser.region : data['Region'];
                            finalUser.county = data['County'];
                            if (!geographicalData[finalUser.region!]?.[finalUser.county!]) error = `County '${finalUser.county}' not found in '${finalUser.region}'.`;
                            break;
                        case UserRole.SUB_COUNTY_ADMIN:
                            finalUser.region = currentUser.currentRole === UserRole.COUNTY_ADMIN ? currentUser.region : data['Region'];
                            finalUser.county = currentUser.currentRole === UserRole.COUNTY_ADMIN ? currentUser.county : data['County'];
                            finalUser.subCounty = data['Sub-County'];
                            if (!geographicalData[finalUser.region!]?.[finalUser.county!]?.[finalUser.subCounty!]) error = `Sub-County '${finalUser.subCounty}' not found in '${finalUser.county}'.`;
                            break;
                    }
                    // Set work jurisdiction to match personal jurisdiction for new admins
                    finalUser.workRegion = finalUser.region;
                    finalUser.workCounty = finalUser.county;
                    finalUser.workSubCounty = finalUser.subCounty;
                }

                if (tscNumber) finalUser.tscNumber = tscNumber;
                if (idNumber) finalUser.idNumber = idNumber;
            }

            if (error) {
                status = 'invalid';
            }

            return { data, status, error, finalUser, existingUser };
        }).filter((u): u is ParsedUser => u !== null);

        setParsedUsers(results);
        setIsLoading(false);
    }, [headers, activeTab, adminRoleToCreate, currentUser, users, geographicalData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result;
                if (typeof text === 'string') {
                    parseCSV(text);
                }
            };
            reader.readAsText(f);
        }
        // By setting the value to null, we ensure the onChange event will fire
        // even if the user selects the same file again.
        e.target.value = '';
    };

    const handleConfirmAdd = async () => {
        const toCreate = validUsers.filter(u => u.status === 'valid-create' && u.finalUser).map(u => u.finalUser!);
        const toUpdate = validUsers.filter(u => u.status === 'valid-update' && u.finalUser).map(u => ({ ...u.existingUser!, ...u.finalUser! }));

        if (toCreate.length === 0 && toUpdate.length === 0) return;

        await bulkCreateOrUpdateUsers(toCreate, toUpdate as User[], (progress) => {
            setLocalProgress(progress);
        });

        // Add 3s delay on success
        setTimeout(() => {
            handleClose();
        }, 3000);
    };

    const handleClose = () => {
        setFile(null);
        setParsedUsers([]);
        setIsLoading(false);
        setLocalProgress(null);
        setActiveTab('judges');
        setAdminRoleToCreate('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk User Operations" size="xl">
            <div className="space-y-4">
                {!localProgress && ( // Hide tabs when processing
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <Button variant="ghost" onClick={() => { setActiveTab('judges'); setFile(null); setParsedUsers([]); }} className={`!rounded-b-none ${activeTab === 'judges' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}>Judges & Coordinators</Button>
                        <Button variant="ghost" onClick={() => { setActiveTab('admins'); setFile(null); setParsedUsers([]); }} className={`!rounded-b-none ${activeTab === 'admins' ? 'border-b-2 border-primary text-primary' : 'text-text-muted-light'}`}>Administrators</Button>
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <label htmlFor="admin-role-select" className="block mb-1 font-medium text-text-light dark:text-text-dark">Admin Role to Create</label>
                        <select id="admin-role-select" value={adminRoleToCreate} onChange={(e) => setAdminRoleToCreate(e.target.value as UserRole)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600">
                            <option value="" disabled>-- Select an Admin Role --</option>
                            {creatableAdminRoles.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    </div>
                )}

                {(activeTab === 'judges' || (activeTab === 'admins' && adminRoleToCreate)) && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            {!localProgress && ( // HIDE when processing
                                <>
                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                        Upload a CSV file or <button onClick={downloadTemplate} className="text-primary hover:underline">download the template</button>.
                                    </p>
                                    {file ? (
                                        <div className="flex items-center gap-2 p-2 rounded-md bg-gray-100 dark:bg-gray-700">
                                            <FileText className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFile(null);
                                                    setParsedUsers([]);
                                                }}
                                                className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500"
                                                title="Clear file"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <Button as="label" variant="secondary" className="cursor-pointer flex items-center gap-2">
                                            <Upload className="w-4 h-4" /> Upload CSV
                                            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>

                        {isLoading && <div className="flex items-center justify-center gap-2 p-4"><Loader className="w-5 h-5 animate-spin" /> Parsing file...</div>}

                        {parsedUsers.length > 0 && !localProgress && ( // HIDE TABLE when processing
                            <div className="border-t dark:border-gray-700 pt-4">
                                <h3 className="font-semibold mb-2 text-text-light dark:text-text-dark">{parsedUsers.length} Rows Found ({validUsers.length} valid)</h3>
                                <div className="overflow-y-auto max-h-60 border dark:border-gray-700 rounded-lg">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark">
                                            <tr>
                                                <th className="px-2 py-2 text-left">Status</th>
                                                <th className="px-2 py-2 text-left">Name</th>
                                                <th className="px-2 py-2 text-left">Email</th>
                                                <th className="px-2 py-2 text-left">Phone</th>
                                                <th className="px-2 py-2 text-left">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedUsers.map((user, index) => (
                                                <tr key={index} className={`border-t dark:border-gray-700 ${user.status === 'invalid' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                    <td className="px-2 py-2">
                                                        {user.status.startsWith('valid')
                                                            ? <CheckCircle className="w-5 h-5 text-green-500"><title>{user.status === 'valid-update' ? 'Will Update' : 'Will Create'}</title></CheckCircle>
                                                            : <XCircle className="w-5 h-5 text-red-500"><title>{user.error}</title></XCircle>
                                                        }
                                                    </td>
                                                    <td className="px-2 py-2">{user.data['Name'] || <i className="text-gray-400">N/A</i>}</td>
                                                    <td className="px-2 py-2">{user.data['Email'] || <i className="text-gray-400">N/A</i>}</td>
                                                    <td className="px-2 py-2">{user.data['Phone Number'] || <i className="text-gray-400">N/A</i>}</td>
                                                    <td className="px-2 py-2 text-xs">
                                                        {activeTab === 'judges' && `Role: ${user.data['Role']}`}
                                                        {activeTab === 'admins' && [user.finalUser?.region, user.finalUser?.county, user.finalUser?.subCounty].filter(Boolean).join(' > ')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {!localProgress && ( // HIDE BUTTONS when processing
                            <div className="flex justify-end gap-4 pt-4">
                                <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                                <Button type="button" onClick={handleConfirmAdd} disabled={validUsers.length === 0 || isLoading || !!localProgress}>
                                    {localProgress ? 'Processing...' : `Process ${validUsers.length} User(s)`}
                                </Button>
                            </div>
                        )}

                        {localProgress && (
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                                <div className="flex justify-between text-sm mb-1 font-medium text-blue-700 dark:text-blue-300">
                                    <span>{localProgress.task}</span>
                                    <span>{Math.round((localProgress.current / localProgress.total) * 100)}% ({localProgress.current}/{localProgress.total})</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                                        style={{ width: `${(localProgress.current / localProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default BulkOperationsModal;