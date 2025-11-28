import React, { ReactNode, useState, useContext } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { AppContext } from '../../context/AppContext';

interface MainLayoutProps {
  children: ReactNode;
}

const TopProgressBar: React.FC = () => {
    const { isPerformingBackgroundTask } = useContext(AppContext);
    return (
        <>
            <style>{`
                .progress-bar-container {
                    overflow: hidden;
                    pointer-events: none;
                }
                .progress-bar-inner {
                    animation: progress-bar-animation 2s infinite linear;
                    background: linear-gradient(to right, transparent 0%, #00A8E8 50%, transparent 100%);
                    width: 100%;
                    height: 100%;
                }
                @keyframes progress-bar-animation {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
            <div className={`fixed top-0 left-0 right-0 h-1 z-[200] progress-bar-container ${isPerformingBackgroundTask ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
                <div className="progress-bar-inner" />
            </div>
        </>
    );
};


const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <TopProgressBar />
      <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;