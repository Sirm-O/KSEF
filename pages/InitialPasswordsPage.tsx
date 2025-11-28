import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Card from '../components/ui/Card';
import { Eye, EyeOff, Clipboard, Check } from 'lucide-react';
import { UserRole } from '../types';

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

const InitialPasswordsPage: React.FC = () => {
    const { user: currentUser, users } = useContext(AppContext);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [copiedPasswords, setCopiedPasswords] = useState<Record<string, boolean>>({});

    const usersWithInitialPasswords = useMemo(() => {
        if (!currentUser) return [];

        const currentUserLevel = ROLE_HIERARCHY_MAP[currentUser.currentRole];

        return users.filter(u => {
            if (!u.initialPassword || u.id === currentUser.id) return false;

            const userHighestRoleLevel = Math.min(...u.roles.map(r => ROLE_HIERARCHY_MAP[r]));

            if (userHighestRoleLevel <= currentUserLevel) {
                return false;
            }

            // FIX: Use work jurisdiction as a fallback for filtering, similar to UserManagementPage.
            // This ensures admins can see passwords for users like Judges whose scope is defined by work area.
            const targetUserWorkRegion = u.workRegion || u.region;
            const targetUserWorkCounty = u.workCounty || u.county;
            const targetUserWorkSubCounty = u.workSubCounty || u.subCounty;

            switch (currentUser.currentRole) {
                case UserRole.REGIONAL_ADMIN:
                    return targetUserWorkRegion === currentUser.region;
                case UserRole.COUNTY_ADMIN:
                    return targetUserWorkCounty === currentUser.county && targetUserWorkRegion === currentUser.region;
                case UserRole.SUB_COUNTY_ADMIN:
                    return targetUserWorkSubCounty === currentUser.subCounty && targetUserWorkCounty === currentUser.county && targetUserWorkRegion === currentUser.region;
                case UserRole.SUPER_ADMIN:
                case UserRole.NATIONAL_ADMIN:
                default:
                    return true;
            }
        });
    }, [users, currentUser]);

    const toggleVisibility = (userId: string) => {
        setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
    };
    
    const copyToClipboard = (password: string, userId: string) => {
        navigator.clipboard.writeText(password).then(() => {
            setCopiedPasswords(prev => ({ ...prev, [userId]: true }));
            setTimeout(() => {
                setCopiedPasswords(prev => ({ ...prev, [userId]: false }));
            }, 2000);
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Initial User Passwords</h1>
                <p className="text-text-muted-light dark:text-text-muted-dark mt-1">
                    This page lists newly created users and their temporary passwords. This list is for administrative purposes, in case a user does not receive their welcome email. Once a user logs in and changes their password, they will be removed from this list.
                </p>
            </Card>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Initial Password</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersWithInitialPasswords.length > 0 ? (
                                usersWithInitialPasswords.map(user => (
                                    <tr key={user.id} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-3 font-medium text-text-light dark:text-text-dark">{user.name}</td>
                                        <td className="px-4 py-3 text-text-light dark:text-text-dark">{user.email}</td>
                                        <td className="px-4 py-3 text-text-light dark:text-text-dark">{user.roles.join(', ')}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                                                <span className="flex-grow text-text-light dark:text-text-dark">
                                                    {visiblePasswords[user.id] ? user.initialPassword : '••••••••••'}
                                                </span>
                                                <button onClick={() => toggleVisibility(user.id)} title={visiblePasswords[user.id] ? 'Hide' : 'Show'} className="text-text-muted-light dark:text-text-muted-dark hover:text-primary">
                                                    {visiblePasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => copyToClipboard(user.initialPassword!, user.id)} title="Copy" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary">
                                                    {copiedPasswords[user.id] ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
                                        No users with temporary passwords found within your scope.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default InitialPasswordsPage;