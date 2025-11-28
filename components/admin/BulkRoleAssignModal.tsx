import React, { useState, useContext, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { User, UserRole } from '../../types';

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

interface BulkRoleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  userIds: string[];
}

const BulkRoleAssignModal: React.FC<BulkRoleAssignModalProps> = ({ isOpen, onClose, userIds }) => {
    const { user: currentUser, users, bulkUpdateUserRoles } = useContext(AppContext);
    const [action, setAction] = useState<'add' | 'remove'>('add');
    const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set());

    const creatableRoles = useMemo(() => {
        if (!currentUser) return [];
        return getCreatableRoles(currentUser.currentRole);
    }, [currentUser]);

    const usersToUpdate = useMemo(() => {
        return users.filter(u => userIds.includes(u.id));
    }, [users, userIds]);

    const removableRoles = useMemo(() => {
        if (action !== 'remove') return [];
        const allRoles = new Set<UserRole>();
        usersToUpdate.forEach(user => {
            user.roles.forEach(role => {
                // Only allow removing roles that the admin could have created
                if (creatableRoles.includes(role)) {
                    allRoles.add(role);
                }
            });
        });
        return Array.from(allRoles).sort();
    }, [usersToUpdate, creatableRoles, action]);

    const handleRoleChange = (role: UserRole) => {
        setSelectedRoles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(role)) {
                newSet.delete(role);
            } else {
                newSet.add(role);
                // --- NEW LOGIC for 'add' action ---
                if (action === 'add') {
                    if (role === UserRole.COORDINATOR) {
                        newSet.delete(UserRole.JUDGE);
                    } else if (role === UserRole.JUDGE) {
                        newSet.delete(UserRole.COORDINATOR);
                    }
                }
                // --- END NEW LOGIC ---
            }
            return newSet;
        });
    };

    const handleSave = () => {
        if (selectedRoles.size === 0) {
            onClose();
            return;
        }
        const roles = Array.from(selectedRoles);
        bulkUpdateUserRoles(
            userIds,
            action === 'add' ? roles : [],
            action === 'remove' ? roles : []
        );
        onClose();
    };
    
    const handleClose = () => {
        setAction('add');
        setSelectedRoles(new Set());
        onClose();
    }

    const rolesToList = action === 'add' ? creatableRoles : removableRoles;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`Bulk Assign Roles for ${userIds.length} Users`}>
            <div className="space-y-4">
                <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                    <Button
                        size="sm"
                        variant={action === 'add' ? 'secondary' : 'ghost'}
                        onClick={() => { setAction('add'); setSelectedRoles(new Set()); }}
                        className="w-1/2"
                    >
                        Add Roles
                    </Button>
                    <Button
                        size="sm"
                        variant={action === 'remove' ? 'secondary' : 'ghost'}
                        onClick={() => { setAction('remove'); setSelectedRoles(new Set()); }}
                        className="w-1/2"
                    >
                        Remove Roles
                    </Button>
                </div>
                
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    Select roles to {action} for the {userIds.length} selected users.
                </p>

                <div className="max-h-60 overflow-y-auto space-y-2 border dark:border-gray-700 p-3 rounded-md">
                    {rolesToList.length > 0 ? rolesToList.map(role => (
                        <div key={role} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id={`role-${role}`}
                                value={role}
                                checked={selectedRoles.has(role)}
                                onChange={() => handleRoleChange(role)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor={`role-${role}`} className="text-sm text-text-light dark:text-text-dark">
                                {role}
                            </label>
                        </div>
                    )) : (
                        <p className="text-center text-text-muted-light dark:text-text-muted-dark p-4">
                            {action === 'add' ? 'No creatable roles.' : 'No common removable roles found.'}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={selectedRoles.size === 0}>
                        Apply Changes
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default BulkRoleAssignModal;