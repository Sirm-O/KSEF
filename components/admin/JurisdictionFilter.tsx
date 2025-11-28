import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { UserRole } from '../../types';
import Card from '../ui/Card';

export interface FilterState {
  region: string;
  county: string;
  subCounty: string;
}

interface JurisdictionFilterProps {
  filter: FilterState;
  onFilterChange: (newFilter: FilterState) => void;
}

const JurisdictionFilter: React.FC<JurisdictionFilterProps> = ({ filter, onFilterChange }) => {
    const { user, geographicalData } = useContext(AppContext);
    
    const [counties, setCounties] = useState<string[]>([]);
    const [subCounties, setSubCounties] = useState<string[]>([]);

    const regions = useMemo(() => {
        if (!user) return [];
        if ([UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN].includes(user.currentRole)) {
            return Object.keys(geographicalData).sort();
        }
        if (user.workRegion) { // Use workRegion for admins' scope
            return [user.workRegion];
        }
        return [];
    }, [user, geographicalData]);

    useEffect(() => {
        if (filter.region && filter.region !== 'All') {
            setCounties(Object.keys(geographicalData[filter.region] || {}).sort());
        } else {
            setCounties([]);
        }
    }, [filter.region, geographicalData]);

    useEffect(() => {
        if (filter.region && filter.region !== 'All' && filter.county && filter.county !== 'All') {
            setSubCounties(Object.keys(geographicalData[filter.region]?.[filter.county] || {}).sort());
        } else {
            setSubCounties([]);
        }
    }, [filter.region, filter.county, geographicalData]);


    if (!user || user.currentRole === UserRole.SUB_COUNTY_ADMIN || user.currentRole === UserRole.PATRON || user.currentRole === UserRole.JUDGE || user.currentRole === UserRole.COORDINATOR) {
        return null; // No filter needed for these roles
    }

    const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onFilterChange({ region: e.target.value, county: 'All', subCounty: 'All' });
    };
    const handleCountyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onFilterChange({ ...filter, county: e.target.value, subCounty: 'All' });
    };
    const handleSubCountyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onFilterChange({ ...filter, subCounty: e.target.value });
    };
    
    return (
        <Card>
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Filter by Jurisdiction</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="region-filter" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Region</label>
                    <select id="region-filter" value={filter.region} onChange={handleRegionChange} disabled={[UserRole.REGIONAL_ADMIN, UserRole.COUNTY_ADMIN].includes(user.currentRole)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-70 disabled:cursor-not-allowed">
                        {regions.length > 1 && <option value="All">All Regions</option>}
                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="county-filter" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">County</label>
                    <select id="county-filter" value={filter.county} onChange={handleCountyChange} disabled={[UserRole.COUNTY_ADMIN].includes(user.currentRole) || !filter.region || filter.region === 'All'} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-70 disabled:cursor-not-allowed">
                        <option value="All">All Counties</option>
                        {counties.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="subcounty-filter" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Sub-County</label>
                    <select id="subcounty-filter" value={filter.subCounty} onChange={handleSubCountyChange} disabled={!filter.county || filter.county === 'All'} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-70 disabled:cursor-not-allowed">
                        <option value="All">All Sub-Counties</option>
                        {subCounties.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                    </select>
                </div>
            </div>
        </Card>
    );
};

export default JurisdictionFilter;