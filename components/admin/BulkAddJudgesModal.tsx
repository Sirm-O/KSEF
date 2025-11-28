import React, { useState, useContext, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { CheckCircle, XCircle, Loader, FileText } from 'lucide-react';

type ParsedUser = {
    name: string;
    email: string;
    school: string;
    status: 'valid' | 'invalid';
    error?: string;
    region?: string;
    county?: string;
    subCounty?: string;
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

interface BulkAddJudgesModalProps {
    isOpen: boolean;
    onClose: () => void;
    adminUser: User;
}

const BulkAddJudgesModal: React.FC<BulkAddJudgesModalProps> = ({ isOpen, onClose, adminUser }) => {
    const { addMultipleUsers, showNotification } = useContext(AppContext);
    const [csvData, setCsvData] = useState('');
    const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const validUsers = useMemo(() => parsedUsers.filter(u => u.status === 'valid'), [parsedUsers]);

    const handleParse = () => {
        setIsLoading(true);
        const lines = csvData.trim().split('\n');
        const results: ParsedUser[] = [];

        lines.forEach(line => {
            if (!line.trim()) return;
            let [name, email] = line.split(',').map(s => s ? s.trim() : '');

            if (!name || !email) {
                results.push({ name, email, school: '', status: 'invalid', error: 'Missing Name or Email.' });
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                results.push({ name, email, school: '', status: 'invalid', error: 'Invalid email format.' });
                return;
            }
            results.push({
                name: toTitleCase(name),
                email,
                school: '',
                status: 'valid',
                region: adminUser.workRegion,
                county: adminUser.workCounty,
                subCounty: adminUser.workSubCounty,
            });
        });
        
        setTimeout(() => {
            setParsedUsers(results);
            setIsLoading(false);
        }, 500);
    };

    const handleConfirmAdd = () => {
        if (validUsers.length === 0) return;
        
        const newUsers: Omit<User, 'id'>[] = validUsers.map(u => {
            const newUserPayload: Omit<User, 'id'> = {
                name: u.name,
                email: u.email,
                roles: [UserRole.JUDGE],
                currentRole: UserRole.JUDGE,
                // Set work jurisdiction from the admin adding the judge
                workRegion: adminUser.workRegion,
                workCounty: adminUser.workCounty,
                workSubCounty: adminUser.workSubCounty,
                // Also set personal geo for convenience from admin's work jurisdiction
                region: adminUser.workRegion,
                county: adminUser.workCounty,
                subCounty: adminUser.workSubCounty,
            };
    
            return newUserPayload;
        });

        addMultipleUsers(newUsers);
        showNotification(`Successfully added ${newUsers.length} judges.`, 'success');
        handleClose();
    };

    const handleClose = () => {
        setCsvData('');
        setParsedUsers([]);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Add Judges" size="xl">
            <div className="space-y-4">
                <div>
                    <label htmlFor="csv-data" className="block mb-1 font-medium text-text-light dark:text-text-dark">
                        Paste Judge Data
                    </label>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-2">
                        Enter one judge per line in the format: <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded-md text-xs">Full Name,Email Address</code>
                    </p>
                    <textarea
                        id="csv-data"
                        rows={8}
                        value={csvData}
                        onChange={e => setCsvData(e.target.value)}
                        placeholder={'Dr. Jane Doe,jane.d@university.ac.ke\nProf. John Smith,j.smith@tum.ac.ke'}
                        className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary"
                    />
                </div>
                <Button onClick={handleParse} disabled={isLoading || !csvData.trim()} className="w-full flex items-center justify-center gap-2">
                    {isLoading ? <><Loader className="w-4 h-4 animate-spin" /> Parsing...</> : <><FileText className="w-4 h-4" /> Parse & Preview</>}
                </Button>

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
                                        <th className="px-2 py-2 text-left">Assigned Area</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedUsers.map((user, index) => {
                                        const assignedArea = [user.region, user.county, user.subCounty].filter(Boolean).join(' > ') || 'National';
                                        return (
                                            <tr key={index} className={`border-t dark:border-gray-700 ${user.status === 'invalid' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                <td className="px-2 py-2">
                                                    {user.status === 'valid' 
                                                        ? <CheckCircle className="w-5 h-5 text-green-500"><title>Valid</title></CheckCircle>
                                                        : <XCircle className="w-5 h-5 text-red-500"><title>{user.error}</title></XCircle>
                                                    }
                                                </td>
                                                <td className="px-2 py-2">{user.name || <i className="text-gray-400">N/A</i>}</td>
                                                <td className="px-2 py-2">{user.email || <i className="text-gray-400">N/A</i>}</td>
                                                <td className="px-2 py-2 text-xs">{assignedArea}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                    <Button type="button" onClick={handleConfirmAdd} disabled={validUsers.length === 0}>
                        Add {validUsers.length} Valid Judges
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default BulkAddJudgesModal;