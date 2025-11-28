import React, { useContext, useState, useRef, useEffect, useMemo } from 'react';
import { Sun, Moon, LogOut, User as UserIcon, Check, Bell, CheckCheck, Clock, Shield, FileUp, GitBranch } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import ToggleSwitch from '../ui/ToggleSwitch';
import { UserRole, AuditLog } from '../../types';
import DeadlineCountdownBanner from '../ui/DeadlineCountdownBanner';
import EditionSwitcher from './EditionSwitcher'; // --- NEW ---
import Logo from '../ui/Logo';

interface HeaderProps {
    toggleSidebar: () => void;
}

// Helper to format time since an event
const timeSince = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

const getOrdinalParts = (n: number): { number: number; suffix: string } => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return { number: n, suffix };
};

// --- NEW COMPONENT: JudgingStatusIndicator ---
const JudgingStatusIndicator: React.FC = () => {
    const { user, isWithinJudgingHours, applicableJudgingHours } = useContext(AppContext);
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [isUrgent, setIsUrgent] = useState(false);

    const isJudgeOrCoordinator = user && (user.currentRole === UserRole.JUDGE || user.currentRole === UserRole.COORDINATOR);

    useEffect(() => {
        if (!isJudgeOrCoordinator) return;

        // This effect will re-run if the judging window changes (e.g., starts or ends)
        const now = new Date();
        const [startH, startM] = applicableJudgingHours.startTime.split(':').map(Number);
        const [endH, endM] = applicableJudgingHours.endTime.split(':').map(Number);

        const startTime = new Date(now);
        startTime.setHours(startH, startM, 0, 0);

        const endTime = new Date(now);
        endTime.setHours(endH, endM, 0, 0);

        let nextTarget: Date;

        if (isWithinJudgingHours) {
            nextTarget = endTime;
        } else {
            if (now < startTime) {
                nextTarget = startTime; // Countdown to start time today
            } else {
                nextTarget = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // Countdown to start time tomorrow
            }
        }

        const interval = setInterval(() => {
            const currentNow = new Date();
            const difference = nextTarget.getTime() - currentNow.getTime();

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                setTimeLeft({ days, hours, minutes, seconds });

                // Check for urgent status
                if (isWithinJudgingHours && days === 0 && hours === 0 && minutes < 10) {
                    setIsUrgent(true);
                } else {
                    setIsUrgent(false);
                }
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                setIsUrgent(false);
                // Note: The timer stops at 0. The isWithinJudgingHours prop from context
                // will eventually update, triggering this useEffect to run again and set the next target.
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isJudgeOrCoordinator, applicableJudgingHours, isWithinJudgingHours]);


    if (!isJudgeOrCoordinator) {
        return null;
    }

    const formattedTime = useMemo(() => {
        if (timeLeft.days > 0) {
            return `${timeLeft.days}d ${String(timeLeft.hours).padStart(2, '0')}h`;
        }
        return `${String(timeLeft.hours).padStart(2, '0')}:${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`;
    }, [timeLeft]);
    
    const hasTimeLeft = timeLeft.days > 0 || timeLeft.hours > 0 || timeLeft.minutes > 0 || timeLeft.seconds > 0;

    const titleText = isUrgent
        ? `Warning: Judging session ends in less than 10 minutes!`
        : isWithinJudgingHours 
        ? `Judging session is active and ends at ${applicableJudgingHours.endTime}.`
        : `Judging is closed. The next session starts at ${applicableJudgingHours.startTime}.`;

    return (
        <>
            <style>{`
                @keyframes ksef-blink {
                    50% { opacity: 0.4; }
                }
                .animate-blink {
                    animation: ksef-blink 3s infinite;
                }
            `}</style>
            <div title={titleText} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md border transition-colors duration-300 ${
                isUrgent
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 animate-blink'
                : isWithinJudgingHours
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                    : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                }`}>
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{isWithinJudgingHours ? 'Judging Active' : 'Judging Closed'}</span>
                {hasTimeLeft && (
                    <>
                        <div className="w-px h-3 bg-current opacity-30"></div>
                        <span className="font-mono tracking-tighter font-bold">{formattedTime}</span>
                    </>
                )}
            </div>
        </>
    );
};


const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { user, theme, toggleTheme, logout, switchRole, auditLogs, markAuditLogAsRead, markAllAuditLogsAsRead, viewingEdition } = useContext(AppContext);
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const portalTitle = useMemo(() => {
    if (!viewingEdition) return "KSEF Portal";
    const { number, suffix } = getOrdinalParts(viewingEdition.year - 1965 + 1);
    
    return (
        <>
            {viewingEdition.name} - {number}<sup>{suffix}</sup> Edition
        </>
    );
  }, [viewingEdition]);

  const myNotifications = React.useMemo(() => {
    if (!user) return [];
    
    const notifications = auditLogs.filter(log => {
        if (log.target_user_id && log.target_user_id === user.id) {
            return true;
        }

        if (log.notified_admin_role && log.notified_admin_role === user.currentRole) {
            switch (user.currentRole) {
                case UserRole.REGIONAL_ADMIN:
                    return log.scope?.region === user.region;
                case UserRole.COUNTY_ADMIN:
                    return log.scope?.region === user.region && log.scope?.county === user.county;
                case UserRole.NATIONAL_ADMIN:
                case UserRole.SUPER_ADMIN:
                    return true;
                default:
                    return false;
            }
        }

        return false;
    });

    return notifications;
  }, [user, auditLogs]);
  
  const unreadCount = myNotifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAdminTitle = () => {
    if (!user) return null;
    switch (user.currentRole) {
      case UserRole.NATIONAL_ADMIN: return 'NATIONAL PORTAL';
      case UserRole.REGIONAL_ADMIN: return user.region ? `${user.region} REGION` : null;
      case UserRole.COUNTY_ADMIN: return user.county ? `${user.county} COUNTY` : null;
      case UserRole.SUB_COUNTY_ADMIN: return user.subCounty ? `${user.subCounty} SUB-COUNTY` : null;
      default: return null;
    }
  };

  const adminTitle = getAdminTitle();
  const patronSchool = user?.currentRole === UserRole.PATRON && user.school ? user.school : null;

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    setUserMenuOpen(false);
  };

  const handleNotificationClick = (log: AuditLog) => {
    if (!log.is_read) {
        markAuditLogAsRead(log.id);
    }
  };

  const RoleSwitcherContent = () => {
    if (!user || user.roles.length <= 1) return null;

    const patronRole = user.roles.find(r => r === UserRole.PATRON);
    const otherRoles = user.roles.filter(r => r !== user.currentRole && r !== UserRole.PATRON);

    return (
        <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
            <h5 className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Switch Role</h5>
            {patronRole && user.currentRole !== UserRole.PATRON && (
                 <button
                    onClick={() => handleRoleChange(UserRole.PATRON)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <Shield size={16} className="text-primary"/> 
                    Switch to Patron View
                </button>
            )}
            {otherRoles.map(role => (
                <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    {role}
                    {user.currentRole === role && <Check className="w-4 h-4 text-primary" />}
                </button>
            ))}
        </div>
    )
  };

  return (
    <header className="sticky top-0 z-30 bg-card-light/80 dark:bg-card-dark/80 backdrop-blur-lg shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center">
            <button onClick={toggleSidebar} className="md:hidden mr-4 text-text-light dark:text-text-dark">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
            <div className="sm:hidden">
                <Logo width={36} height={36} />
            </div>
            <div className="hidden sm:flex items-center gap-3">
                <h1 className="text-xl font-bold text-secondary dark:text-accent-green uppercase">
                  {portalTitle}
                </h1>
                <JudgingStatusIndicator />
                <DeadlineCountdownBanner />
                {adminTitle && (
                    <span className="text-lg font-semibold text-primary uppercase tracking-wide border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                        {adminTitle}
                    </span>
                )}
                {patronSchool && (
                    <span className="text-lg font-semibold text-primary uppercase tracking-wide border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                        {patronSchool}
                    </span>
                )}
            </div>
        </div>

        <div className="sm:hidden flex items-center gap-2">
            <JudgingStatusIndicator />
            <DeadlineCountdownBanner />
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="hidden md:block">
            {user && <EditionSwitcher />}
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            <ToggleSwitch
              checked={theme === 'dark'}
              onChange={toggleTheme}
              ariaLabel="Toggle dark mode"
            />
            <Moon className="h-5 w-5 text-gray-400" />
          </div>

          <div className="relative" ref={notificationsRef}>
            <button onClick={() => setNotificationsOpen(prev => !prev)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <Bell className="h-5 w-5 text-text-light dark:text-text-dark" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">{unreadCount}</span>
                </span>
              )}
            </button>
            {isNotificationsOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-card-light dark:bg-card-dark border dark:border-gray-700 rounded-md shadow-lg z-50">
                    <div className="p-3 flex justify-between items-center border-b dark:border-gray-700">
                        <h4 className="font-semibold text-sm">Notifications</h4>
                        {unreadCount > 0 && <button onClick={markAllAuditLogsAsRead} className="text-xs text-primary hover:underline flex items-center gap-1"><CheckCheck size={14}/>Mark all as read</button>}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {myNotifications.length > 0 ? myNotifications.slice(0, 10).map(log => (
                           <div key={log.id} onClick={() => handleNotificationClick(log)} className={`p-3 border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${!log.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                               <p className="text-sm font-medium">{log.action}</p>
                               <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">{log.performing_admin_name} • {timeSince(new Date(log.timestamp))}</p>
                           </div>
                        )) : (
                            <p className="p-4 text-center text-sm text-text-muted-light dark:text-text-muted-dark">No new notifications.</p>
                        )}
                    </div>
                </div>
            )}
          </div>
          
          {/* USER MENU */}
          <div className="relative" ref={userMenuRef}>
            <button 
                className="p-2 bg-gray-200 dark:bg-secondary rounded-full"
                onClick={() => setUserMenuOpen(prev => !prev)}
            >
              <UserIcon className="h-5 w-5 text-secondary dark:text-white" />
            </button>
             {isUserMenuOpen && user && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-card-light dark:bg-card-dark border dark:border-gray-700 rounded-md shadow-lg z-50">
                    <div className="p-3 border-b dark:border-gray-700">
                        <p className="font-semibold text-text-light dark:text-text-dark text-sm truncate">{user.name}</p>
                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{user.currentRole}</p>
                    </div>
                    <div className="py-1">
                        <Link
                            to="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <UserIcon size={16} className="text-primary"/> My Profile
                        </Link>
                        <div className="md:hidden border-t border-b border-gray-200 dark:border-gray-700 my-1 py-2 space-y-2">
                            <div className="px-3 space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Viewing Edition</label>
                                {user && <EditionSwitcher />}
                            </div>
                            <div className="px-3 flex items-center justify-between">
                                <span className="text-sm font-medium">Theme</span>
                                <div className="flex items-center space-x-2">
                                    <Sun className="h-5 w-5 text-yellow-500" />
                                    <ToggleSwitch
                                    checked={theme === 'dark'}
                                    onChange={toggleTheme}
                                    ariaLabel="Toggle dark mode"
                                    />
                                    <Moon className="h-5 w-5 text-gray-400" />
                                </div>
                            </div>
                        </div>
                        <RoleSwitcherContent />
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700">
                        <button onClick={logout} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40">
                            <LogOut className="w-4 h-4"/>
                            Logout
                        </button>
                    </div>
                </div>
             )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;