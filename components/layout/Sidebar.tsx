import React, { useContext } from 'react';
import { LayoutDashboard, Users, ClipboardList, BookOpen, BarChart2, UserCircle, KeyRound, Settings, GitBranch, Award } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { UserRole } from '../../types';
// FIX: Replaced Link with NavLink to support active link styling.
import { NavLink } from 'react-router-dom';
import Logo from '../ui/Logo';

interface SidebarProps {
    isOpen: boolean;
    closeSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, closeSidebar }) => {
    const { user, activeJudgingInfo } = useContext(AppContext);

    const isJudgingLocked = (user?.currentRole === UserRole.JUDGE || user?.currentRole === UserRole.COORDINATOR) && !!activeJudgingInfo;

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (isJudgingLocked) {
            e.preventDefault();
            return;
        }
        // Close sidebar on mobile after a link is clicked.
        // Tailwind's 'md' breakpoint is 768px.
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    };

    const getNavLinks = () => {
        const baseLinks = [
            { to: '/dashboard', icon: <LayoutDashboard />, label: 'Dashboard' },
            { to: '/profile', icon: <UserCircle />, label: 'My Profile' }
        ];

        switch (user?.currentRole) {
            case UserRole.SUPER_ADMIN:
                return [
                    ...baseLinks,
                    { to: '/users', icon: <Users />, label: 'User Management' },
                    { to: '/editions', icon: <GitBranch />, label: 'Edition Manager' },
                    { to: '/settings', icon: <Settings />, label: 'Settings' },
                    { to: '/initial-passwords', icon: <KeyRound />, label: 'User Passwords' },
                    { to: '/certificates', icon: <Award />, label: 'Certificates' },
                ];
            case UserRole.NATIONAL_ADMIN:
                return [
                    ...baseLinks,
                    { to: '/users', icon: <Users />, label: 'User Management' },
                    { to: '/settings', icon: <Settings />, label: 'Settings' },
                    { to: '/initial-passwords', icon: <KeyRound />, label: 'User Passwords' },
                    { to: '/projects', icon: <ClipboardList />, label: 'Projects' },
                    { to: '/certificates', icon: <Award />, label: 'Certificates' },
                    { to: '/reporting', icon: <BarChart2 />, label: 'Reporting' },
                ];
            case UserRole.REGIONAL_ADMIN:
            case UserRole.COUNTY_ADMIN:
            case UserRole.SUB_COUNTY_ADMIN:
                return [
                    ...baseLinks,
                    { to: '/users', icon: <Users />, label: 'User Management' },
                    { to: '/settings', icon: <Settings />, label: 'Settings' },
                    { to: '/initial-passwords', icon: <KeyRound />, label: 'User Passwords' },
                    { to: '/projects', icon: <ClipboardList />, label: 'Projects' },
                    { to: '/certificates', icon: <Award />, label: 'Certificates' },
                    { to: '/reporting', icon: <BarChart2 />, label: 'Reporting' },
                ];
            case UserRole.JUDGE:
            case UserRole.COORDINATOR:
                 return [
                    ...baseLinks,
                    { to: '/judging-guide', icon: <BookOpen />, label: 'Marking Guide' },
                 ];
            case UserRole.PATRON:
                return [
                    ...baseLinks,
                    { to: '/certificates', icon: <Award />, label: 'Certificates' },
                    { to: '/reporting', icon: <BarChart2 />, label: 'Competition Reports' },
                ];
            default:
                return baseLinks;
        }
    };
    
    return (
        <aside className={`fixed md:relative z-40 h-screen bg-secondary text-white transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-0 md:w-64'} overflow-hidden border-r border-black/20 dark:border-white/10`}>
            <div className="flex items-center h-16 px-4">
                 <div className="flex items-center gap-2">
                    <div className="bg-white p-1 rounded-lg">
                       <Logo width={32} height={32} />
                    </div>
                    <span className={`font-bold text-xl whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>KSEF</span>
                </div>
            </div>
            <nav className="mt-8">
                <ul>
                    {getNavLinks().map(link => (
                        <li key={link.to} className="relative">
                            {/* FIX: Replaced Link with NavLink and added active styling logic. */}
                            <NavLink 
                                to={link.to} 
                                onClick={handleLinkClick} 
                                className={({ isActive }) => {
                                    const baseClasses = 'flex items-center py-3 rounded-lg transition-colors';
                                    const layoutClasses = isOpen ? 'px-4 mx-4' : 'px-0 justify-center mx-2 md:justify-start md:px-4 md:mx-4';
                                    const stateClasses = isJudgingLocked
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isActive
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-primary-dark';
                                    return `${baseClasses} ${layoutClasses} ${stateClasses}`;
                                }}
                                aria-disabled={isJudgingLocked}
                                title={isJudgingLocked ? 'Please complete your active judging session to navigate' : link.label}
                            >
                                {link.icon}
                                <span className={`ml-4 whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>{link.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar;
