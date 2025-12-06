import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Card from '../components/ui/Card';
import { Eye, EyeOff, Clipboard, Check, MessageCircle, Send, Mail } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
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

    // --- Bulk Sending State ---
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchMode, setBatchMode] = useState<'whatsapp' | 'email'>('whatsapp');
    const [batchQueue, setBatchQueue] = useState<any[]>([]);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

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

    // --- Bulk Selection Handlers ---
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(usersWithInitialPasswords.map(u => u.id));
            setSelectedUserIds(allIds);
        } else {
            setSelectedUserIds(new Set());
        }
    };

    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };

    const startBatchSend = (mode: 'whatsapp' | 'email') => {
        const queue = usersWithInitialPasswords.filter(u => selectedUserIds.has(u.id));
        setBatchQueue(queue);
        setBatchMode(mode);
        setCurrentBatchIndex(0);
        setIsBatchModalOpen(true);
    };

    const sendWhatsAppMessage = (user: any) => {
        if (!user.phoneNumber) return;
        const message = `Halo ${user.name}, Welcome to KSEF! Your account has been created. Your initial password is: *${user.initialPassword}* . Please login at https://portal.ksef.co.ke .\n\nRegards,\nKSEF System`;
        let cleanPhone = user.phoneNumber.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.substring(1);

        const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const sendEmailMessage = (user: any) => {
        if (!user.email) return;
        const subject = `Welcome to KSEF - Your Account Details`;
        const body = `Halo ${user.name},\n\nWelcome to KSEF! Your account has been created.\n\nYour initial password is: ${user.initialPassword}\n\nPlease login at https://portal.ksef.co.ke\n\nRegards,\nKSEF System`;

        const url = `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(url, '_blank');
    };

    const handleBatchNext = () => {
        if (currentBatchIndex < batchQueue.length - 1) {
            setCurrentBatchIndex(prev => prev + 1);
        } else {
            setIsBatchModalOpen(false);
            // Optional: Clear selection after done?
            // setSelectedUserIds(new Set());
        }
    };

    const handleBatchSkip = () => {
        handleBatchNext();
    };

    const currentUserInBatch = batchQueue[currentBatchIndex];
    const isAllSelected = usersWithInitialPasswords.length > 0 && selectedUserIds.size === usersWithInitialPasswords.length;

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Initial User Passwords</h1>
                        <p className="text-text-muted-light dark:text-text-muted-dark mt-1">
                            This page lists newly created users and their temporary passwords.
                        </p>
                    </div>
                    {selectedUserIds.size > 0 && (
                        <div className="flex gap-2">
                            <Button onClick={() => startBatchSend('whatsapp')} className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none">
                                <MessageCircle className="w-4 h-4" /> WhatsApp ({selectedUserIds.size})
                            </Button>
                            <Button onClick={() => startBatchSend('email')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none">
                                <Mail className="w-4 h-4" /> Email ({selectedUserIds.size})
                            </Button>
                        </div>

                    )}
                </div>
            </Card >

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 w-4">
                                    <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-gray-300 text-primary focus:ring-primary" />
                                </th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Initial Password</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersWithInitialPasswords.length > 0 ? (
                                usersWithInitialPasswords.map(user => (
                                    <tr key={user.id} className={`border-b dark:border-gray-700 ${selectedUserIds.has(user.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => handleSelectUser(user.id)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                                        </td>
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
                                                {user.phoneNumber && (
                                                    <button onClick={() => {
                                                        const message = `Halo ${user.name}, Welcome to KSEF! Your account has been created. Your initial password is: *${user.initialPassword}* . Please login at https://portal.ksef.co.ke .\n\nRegards,\nKSEF System`;
                                                        let cleanPhone = user.phoneNumber.replace(/\D/g, '');
                                                        if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.substring(1);

                                                        const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
                                                        window.open(url, '_blank');
                                                    }} title="Send via WhatsApp" className="text-text-muted-light dark:text-text-muted-dark hover:text-[#25D366]">
                                                        <MessageCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
                                        No users with temporary passwords found within your scope.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>


            {/* --- Batch Sender Modal --- */}
            {
                isBatchModalOpen && currentUserInBatch && (
                    <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title={`Batch ${batchMode === 'whatsapp' ? 'WhatsApp' : 'Email'} Sender`} size="md">
                        <div className="flex flex-col space-y-6">
                            <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>Messaging User {currentBatchIndex + 1} of {batchQueue.length}</span>
                                <span>{Math.round(((currentBatchIndex) / batchQueue.length) * 100)}% Complete</span>
                            </div>

                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all duration-300 ${batchMode === 'whatsapp' ? 'bg-[#25D366]' : 'bg-blue-600'}`} style={{ width: `${((currentBatchIndex) / batchQueue.length) * 100}%` }}></div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 text-center">
                                <h3 className="font-bold text-lg mb-1">{currentUserInBatch.name}</h3>
                                <p className="text-sm text-gray-500 mb-2">{currentUserInBatch.email}</p>
                                {batchMode === 'whatsapp' ? (
                                    currentUserInBatch.phoneNumber ? (
                                        <div className="font-mono bg-white dark:bg-gray-900 border px-3 py-1 rounded inline-block text-sm">
                                            {currentUserInBatch.phoneNumber}
                                        </div>
                                    ) : (
                                        <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-bold">No Phone Number</span>
                                    )
                                ) : (
                                    <div className="font-mono bg-white dark:bg-gray-900 border px-3 py-1 rounded inline-block text-sm">
                                        {currentUserInBatch.email}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                {batchMode === 'whatsapp' ? (
                                    currentUserInBatch.phoneNumber ? (
                                        <Button
                                            onClick={() => sendWhatsAppMessage(currentUserInBatch)}
                                            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none py-3 text-lg"
                                        >
                                            <Send className="w-5 h-5" /> Open WhatsApp
                                        </Button>
                                    ) : (
                                        <div className="text-center text-sm text-amber-600">
                                            This user has no phone number. Skip to next.
                                        </div>
                                    )
                                ) : (
                                    <Button
                                        onClick={() => sendEmailMessage(currentUserInBatch)}
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none py-3 text-lg"
                                    >
                                        <Mail className="w-5 h-5" /> Open Email Client
                                    </Button>
                                )}

                                <div className="flex gap-3 mt-2">
                                    <Button variant="secondary" onClick={handleBatchSkip} className="flex-1">
                                        {currentUserInBatch.phoneNumber ? 'Skip / Next User' : 'Skip User'}
                                    </Button>
                                    <Button variant="ghost" onClick={() => setIsBatchModalOpen(false)} className="flex-1">
                                        Stop Batch
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )
            }
        </div >
    );
};

export default InitialPasswordsPage;