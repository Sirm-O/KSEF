import React, { useState, useEffect, useContext } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { UserRole } from '../../types';
import { ChevronRight, User as UserIcon, Home, MapPin, Building, Globe, Map as MapIcon, FolderKanban, FileText } from 'lucide-react';

interface GeoHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  startFrom?: 'regions' | 'schools';
}

const GeoHierarchyModal: React.FC<GeoHierarchyModalProps> = ({ isOpen, onClose, startFrom = 'regions' }) => {
    // FIX: Add viewingLevel to context destructuring
    const { geographicalData, users, schoolData, projects, assignments, calculateProjectScores, calculateRankingsAndPoints, viewingLevel } = useContext(AppContext);
    const [path, setPath] = useState<string[]>([]);
    const [displayItems, setDisplayItems] = useState<{
        name: string;
        admin?: string;
        type: 'region' | 'county' | 'subCounty' | 'zone' | 'school' | 'category' | 'project';
        details?: string;
    }[]>([]);
    const [currentTitle, setCurrentTitle] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => setPath([]), 300);
            return;
        }

        const getProjectDisplayItems = (filteredProjects: typeof projects) => {
            const rankingData = calculateRankingsAndPoints();

            return filteredProjects
                .sort((a, b) => a.title.localeCompare(b.title))
                .map(p => {
                    // FIX: Pass viewingLevel to calculateProjectScores
                    const scores = calculateProjectScores(p.id, viewingLevel);
                    const rankInfo = rankingData.projectsWithPoints.find(rp => rp.id === p.id);

                    const statusText = p.isEliminated ? `Eliminated at ${p.currentLevel}` : `Active at ${p.currentLevel}`;
                    
                    const projectAssignments = assignments.filter(a => a.projectId === p.id);
                    const completedCount = projectAssignments.filter(a => a.status === 'Completed').length;
                    let judgingStatusText = 'Not Started';
                    if (projectAssignments.length > 0 && completedCount === projectAssignments.length) {
                        judgingStatusText = 'Completed';
                    } else if (projectAssignments.some(a => a.status !== 'Not Started')) {
                        judgingStatusText = 'In Progress';
                    }

                    const details = `Status: ${statusText} | Judging: ${judgingStatusText} | Score: ${scores.isFullyJudged ? scores.totalScore.toFixed(2) : 'N/A'} | Rank: ${rankInfo ? `#${rankInfo.categoryRank}` : 'N/A'}`;

                    return {
                        name: p.title,
                        type: 'project' as const,
                        details: details,
                    };
                });
        };

        if (startFrom === 'regions') {
            if (path.length === 0) { // Regions
                setCurrentTitle('All Regions');
                const items = Object.keys(geographicalData).sort().map(region => {
                    const admin = users.find(u => u.roles.includes(UserRole.REGIONAL_ADMIN) && u.region === region);
                    return { name: region, admin: admin?.name, type: 'region' as const };
                });
                setDisplayItems(items);
            } else if (path.length === 1) { // Counties
                const [region] = path;
                setCurrentTitle(region);
                const counties = Object.keys(geographicalData[region] || {}).sort();
                const items = counties.map(county => {
                    const admin = users.find(u => u.roles.includes(UserRole.COUNTY_ADMIN) && u.region === region && u.county === county);
                    return { name: county, admin: admin?.name, type: 'county' as const };
                });
                setDisplayItems(items);
            } else if (path.length === 2) { // Sub-Counties
                const [region, county] = path;
                setCurrentTitle(county);
                const subCounties = Object.keys(geographicalData[region]?.[county] || {}).sort();
                const items = subCounties.map(subCounty => {
                    const admin = users.find(u => u.roles.includes(UserRole.SUB_COUNTY_ADMIN) && u.region === region && u.county === county && u.subCounty === subCounty);
                    return { name: subCounty, admin: admin?.name, type: 'subCounty' as const };
                });
                setDisplayItems(items);
            } else if (path.length === 3) { // Zones
                const [region, county, subCounty] = path;
                setCurrentTitle(subCounty);
                const staticZones = geographicalData[region]?.[county]?.[subCounty] || [];
                const dynamicZones = schoolData
                    .filter(s => s.region === region && s.county === county && s.subCounty === subCounty && s.zone)
                    .map(s => s.zone);
                const allZones = [...new Set([...staticZones, ...dynamicZones])].sort();
                setDisplayItems(allZones.map(z => ({ name: z, type: 'zone' })));
            } else if (path.length === 4) { // Schools
                const [region, county, subCounty, zone] = path;
                setCurrentTitle(zone);
                const schoolsInZone = schoolData
                    .filter(s => s.region === region && s.county === county && s.subCounty === subCounty && s.zone === zone)
                    .sort((a, b) => a.school.localeCompare(b.school));
                setDisplayItems(schoolsInZone.map(s => ({ name: s.school, type: 'school' })));
            } else if (path.length === 5) { // Categories
                const [,,, , school] = path;
                setCurrentTitle(school);
                const projectsInSchool = projects.filter(p => p.school === school);
                const categories = [...new Set(projectsInSchool.map(p => p.category))].sort();
                setDisplayItems(categories.map(c => ({ name: c, type: 'category' })));
            } else if (path.length === 6) { // Projects
                const [,,,, school, category] = path;
                setCurrentTitle(category);
                const projectsToDisplay = projects.filter(p => p.school === school && p.category === category);
                setDisplayItems(getProjectDisplayItems(projectsToDisplay));
            }
        } else { // startFrom === 'schools'
            if (path.length === 0) { // All Schools
                setCurrentTitle('All Schools');
                const schools = [...new Set(schoolData.map(s => s.school))].sort();
                setDisplayItems(schools.map(s => ({ name: s, type: 'school' })));
            } else if (path.length === 1) { // Categories in a School
                const [school] = path;
                setCurrentTitle(school);
                const projectsInSchool = projects.filter(p => p.school === school);
                const categories = [...new Set(projectsInSchool.map(p => p.category))].sort();
                setDisplayItems(categories.map(c => ({ name: c, type: 'category' })));
            } else if (path.length === 2) { // Projects in a Category
                const [school, category] = path;
                setCurrentTitle(category);
                const projectsToDisplay = projects.filter(p => p.school === school && p.category === category);
                setDisplayItems(getProjectDisplayItems(projectsToDisplay));
            }
        }
    }, [path, isOpen, geographicalData, users, schoolData, projects, startFrom, assignments, calculateProjectScores, calculateRankingsAndPoints, viewingLevel]);

    const handleItemClick = (itemName: string, itemType: string) => {
        if (itemType !== 'project') {
            setPath(prev => [...prev, itemName]);
        }
    };

    const handleBreadcrumbClick = (index: number) => {
        setPath(prev => prev.slice(0, index));
    };
    
    const getTypeIcon = (type: string) => {
        switch(type) {
            case 'region': return <Globe className="w-5 h-5 text-primary" />;
            case 'county': return <MapIcon className="w-5 h-5 text-primary" />;
            case 'subCounty': return <Building className="w-5 h-5 text-primary" />;
            case 'zone': return <MapPin className="w-5 h-5 text-primary" />;
            case 'school': return <Home className="w-5 h-5 text-primary" />;
            case 'category': return <FolderKanban className="w-5 h-5 text-primary" />;
            case 'project': return <FileText className="w-5 h-5 text-primary" />;
            default: return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Geographical Explorer" size="lg">
            <div className="space-y-4">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-text-muted-light dark:text-text-muted-dark flex-wrap">
                    <button onClick={() => setPath([])} className="hover:text-primary font-semibold">{startFrom === 'regions' ? 'All Regions' : 'All Schools'}</button>
                    {path.map((p, index) => (
                        <React.Fragment key={index}>
                            <span className="text-gray-400">&gt;</span>
                            <button onClick={() => handleBreadcrumbClick(index + 1)} className="hover:text-primary">
                                {p}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
                
                <h3 className="text-xl font-bold text-secondary dark:text-accent-green border-b dark:border-gray-700 pb-2">{currentTitle}</h3>

                {/* List of items */}
                <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                    {displayItems.length > 0 ? displayItems.map(item => {
                        const isClickable = item.type !== 'project';
                        return (
                            <div
                                key={item.name}
                                onClick={() => isClickable && handleItemClick(item.name, item.type)}
                                className={`p-3 rounded-lg flex justify-between items-center transition-colors ${isClickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''} bg-gray-50 dark:bg-gray-800/50`}
                                role={isClickable ? 'button' : undefined}
                                tabIndex={isClickable ? 0 : -1}
                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && isClickable && handleItemClick(item.name, item.type)}
                            >
                                <div className="flex items-center gap-3">
                                    {getTypeIcon(item.type)}
                                    <div>
                                        <p className="font-semibold text-text-light dark:text-text-dark">{item.name}</p>
                                        {(item.admin || item.details) && (
                                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark flex items-center gap-1">
                                                {item.admin && <UserIcon className="w-3 h-3" />}
                                                {item.admin || item.details}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {isClickable && <ChevronRight className="w-5 h-5 text-gray-400" />}
                            </div>
                        )
                    }) : (
                        <p className="text-center text-text-muted-light dark:text-text-muted-dark py-4">
                            No items to display at this level.
                        </p>
                    )}
                </div>
                <div className="flex justify-end pt-4">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default GeoHierarchyModal;