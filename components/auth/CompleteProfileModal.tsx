import React, { useState, useContext, useEffect, FormEvent, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import Button from '../ui/Button';
import { SchoolLocation, User, UserRole } from '../../types';

interface CompleteProfileModalProps {
    isOpen: boolean;
    onSave: (updatedUser: User) => void;
    isForced?: boolean;
}

// Helper function to format strings to Title Case
const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ isOpen, onSave, isForced = false }) => {
    const { user, schoolData, addSchoolData, geographicalData, showNotification } = useContext(AppContext);

    const [formData, setFormData] = useState<User | null>(user);
    const [counties, setCounties] = useState<string[]>([]);
    const [subCounties, setSubCounties] = useState<string[]>([]);
    const [zones, setZones] = useState<string[]>([]);
    
    const [schoolInput, setSchoolInput] = useState('');
    const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
    
    const [selectedZone, setSelectedZone] = useState('');
    const [otherZoneName, setOtherZoneName] = useState('');
    const [subjectsInput, setSubjectsInput] = useState('');
    
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [jurisdictionError, setJurisdictionError] = useState<string | null>(null);

    const isJudgeOrCoordinator = useMemo(() => user && [UserRole.JUDGE, UserRole.COORDINATOR].includes(user.currentRole), [user]);

    const knownSchools = useMemo(() => [...new Set(schoolData.map(s => s.school))].sort(), [schoolData]);
    
    const filteredSchools = useMemo(() => {
        if (!schoolInput) {
            return [];
        }
        if (knownSchools.some(s => s.toLowerCase() === schoolInput.toLowerCase())) {
            return [];
        }
        return knownSchools.filter(school =>
            school.toLowerCase().includes(schoolInput.toLowerCase())
        );
    }, [schoolInput, knownSchools]);

    const selectedSchoolInfo = useMemo(() => {
        return schoolData.find(s => s.school === schoolInput);
    }, [schoolInput, schoolData]);

    useEffect(() => {
        if (user) {
            setFormData({ ...user, subjects: user.subjects || [] });
            setSubjectsInput((user.subjects || []).join(', '));
            setSchoolInput(user.school || '');
            
            if (user.region) {
                setCounties(Object.keys(geographicalData[user.region] || {}).sort());
                if (user.county) {
                    setSubCounties(Object.keys(geographicalData[user.region]?.[user.county] || {}).sort());
                    if (user.subCounty) {
                        const staticZones = geographicalData[user.region]?.[user.county]?.[user.subCounty] || [];
                        const dynamicZones = schoolData
                            .filter(s => s.region === user.region && s.county === user.county && s.subCounty === user.subCounty)
                            .map(s => s.zone);
                        const allZones = [...new Set([...staticZones, ...dynamicZones])].sort();
                        setZones(allZones);
                        const isKnownZone = allZones.includes(user.zone || '');
                        setSelectedZone(isKnownZone ? (user.zone || '') : 'Other');
                        if (!isKnownZone) setOtherZoneName(user.zone || '');
                    }
                }
            }
        }
    }, [user, geographicalData, schoolData]);

    const handleSchoolSelect = (schoolName: string) => {
        setSchoolInput(schoolName);
        setIsSchoolDropdownOpen(false);
        const schoolInfo = schoolData.find(s => s.school === schoolName);
        if (schoolInfo && formData) {
            // JURISDICTION CHECK
            if (!isJudgeOrCoordinator) {
                if (
                    (user?.region && user.region !== schoolInfo.region) ||
                    (user?.county && user.county !== schoolInfo.county) ||
                    (user?.subCounty && user.subCounty !== schoolInfo.subCounty)
                ) {
                    const errorMsg = `Error: The school "${schoolName}" is outside your assigned jurisdiction.`;
                    showNotification(errorMsg, 'error');
                    setJurisdictionError(errorMsg);
                    setFormData(prev => prev ? { ...prev, school: schoolName } : null);
                    return;
                }
            }
            
            setJurisdictionError(null);
            
            const newGeoData = {
                region: schoolInfo.region || '',
                county: schoolInfo.county || '',
                subCounty: schoolInfo.subCounty || '',
                zone: schoolInfo.zone || ''
            };
            setFormData({ ...formData, ...newGeoData, school: schoolName });

            if (newGeoData.region) {
                setCounties(Object.keys(geographicalData[newGeoData.region] || {}).sort());
            }
            if (newGeoData.county) {
                setSubCounties(Object.keys(geographicalData[newGeoData.region]?.[newGeoData.county] || {}).sort());
            }
            if (newGeoData.subCounty) {
                const staticZones = geographicalData[newGeoData.region]?.[newGeoData.county]?.[newGeoData.subCounty] || [];
                const dynamicZones = schoolData
                    .filter(s => s.region === newGeoData.region && s.county === newGeoData.county && s.subCounty === newGeoData.subCounty && s.zone)
                    .map(s => s.zone!);
                
                const allPotentialZones = new Set([...staticZones, ...dynamicZones]);
                if(newGeoData.zone) {
                    allPotentialZones.add(newGeoData.zone);
                }
                const allZones = Array.from(allPotentialZones).sort();
                setZones(allZones);
                
                setSelectedZone(newGeoData.zone);
                setOtherZoneName('');
            } else {
                setZones([]);
                setSelectedZone('');
                setOtherZoneName('');
            }
        }
    };
    
    const handleSchoolInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSchoolInput(value);
        setJurisdictionError(null);
        if (errors['school-input']) {
            setErrors(prev => ({...prev, 'school-input': ''}));
        }
        
        setFormData(prev => {
            if (!prev || !user) return null;

            const newFormData = { ...prev, school: value };
            
            if (isJudgeOrCoordinator) {
                 newFormData.region = '';
                 newFormData.county = '';
                 newFormData.subCounty = '';
                 newFormData.zone = '';
                 setCounties(Object.keys(geographicalData).sort());
                 setSubCounties([]);
                 setZones([]);
                 setSelectedZone('');
            } else {
                if (!user.region) {
                    newFormData.region = '';
                    setCounties(Object.keys(geographicalData).sort());
                }
                if (!user.county) {
                    newFormData.county = '';
                    setSubCounties([]);
                }
                if (!user.subCounty) {
                    newFormData.subCounty = '';
                    setZones([]);
                }
                newFormData.zone = '';
                setSelectedZone('');
            }

            return newFormData;
        });
    };

    const handleSchoolInputBlur = () => {
        setTimeout(() => {
            setIsSchoolDropdownOpen(false);
            const formattedSchool = toTitleCase(schoolInput);
            setSchoolInput(formattedSchool);
            if (formData) {
                setFormData({ ...formData, school: formattedSchool });
            }
        }, 200);
    };

    const handleGeoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (errors[name]) {
            setErrors(prev => ({...prev, [name]: ''}));
        }
        setFormData(prev => {
            if (!prev) return null;
            let d = { ...prev, [name]: value };
            if (name === 'region') {
                d = {...d, county: '', subCounty: '', zone: ''};
                setCounties(Object.keys(geographicalData[value] || {}).sort());
                setSubCounties([]); setZones([]); setSelectedZone('');
            } else if (name === 'county') {
                d = {...d, subCounty: '', zone: ''};
                if (d.region) setSubCounties(Object.keys(geographicalData[d.region]?.[value] || {}).sort());
                setZones([]); setSelectedZone('');
            } else if (name === 'subCounty') {
                d = {...d, zone: ''};
                if (d.region && d.county) {
                     const staticZones = geographicalData[d.region]?.[d.county]?.[value] || [];
                    const dynamicZones = schoolData
                        .filter(s => s.region === d.region && s.county === d.county && s.subCounty === value)
                        .map(s => s.zone);
                    const allZones = [...new Set([...staticZones, ...dynamicZones])].sort();
                    setZones(allZones);
                }
                setSelectedZone('');
            }
            return d;
        });
    };

    const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (errors.zone || errors.otherZoneName) {
            setErrors(prev => ({...prev, zone: '', otherZoneName: ''}));
        }
        setSelectedZone(value);
        if (value !== 'Other') {
            setFormData(prev => prev ? { ...prev, zone: value } : null);
            setOtherZoneName('');
        } else {
             setFormData(prev => prev ? { ...prev, zone: '' } : null);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => prev ? { ...prev, [name]: value } : null);
         if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };
    
    const handleTextBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => prev ? { ...prev, [name]: toTitleCase(value) } : null);
    };

    const handleSubjectsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSubjectsInput(e.target.value);
        if (errors.subjects) {
            setErrors(prev => ({ ...prev, subjects: '' }));
        }
    };

    const handleSubjectsBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const subjectsArray = value.split(',').map(s => toTitleCase(s.trim())).filter(Boolean);
        setFormData(prev => prev ? { ...prev, subjects: subjectsArray } : null);
        
        const error = validateField('subjects', value);
        setErrors(prev => ({ ...prev, subjects: error }));
    };

    const validateField = (name: string, value: string) => {
        switch (name) {
            case 'name':
                return value.trim() ? '' : 'Full Name is required.';
            case 'idNumber':
                if (!value.trim()) return 'ID Number is required.';
                if (!/^\d{7,8}$/.test(value)) return 'ID Number must be 7 or 8 digits.';
                return '';
            case 'tscNumber':
                if (!value.trim()) return 'TSC/Service Number is required.';
                if (!/^\d{5,7}$/.test(value)) return 'TSC Number must be 5 to 7 digits.';
                return '';
            case 'phoneNumber':
                if (!value.trim()) return 'Phone Number is required.';
                if (!/^0\d{9}$/.test(value)) return 'Phone Number must be 10 digits and start with 0.';
                return '';
            case 'subjects':
                return value.trim() ? '' : 'At least one subject/area of expertise is required.';
            case 'school-input':
                return value.trim() ? '' : 'School Name is required.';
            case 'region':
            case 'county':
            case 'subCounty':
                return value ? '' : 'This field is required.';
            case 'zone':
                 return value ? '' : 'Zone is required.';
            case 'otherZoneName':
                if (selectedZone === 'Other') {
                    return value.trim() ? '' : 'Please specify the zone name.';
                }
                return '';
            default:
                return '';
        }
    };

    const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, id } = e.target;
        if (name === 'subjects') return; // Handled by handleSubjectsBlur
        const fieldName = id === 'school-input' ? id : name;
        const error = validateField(fieldName, value);
        
        setErrors(prev => ({ ...prev, [fieldName]: error }));

        if (name === 'name' && !error) handleTextBlur(e as React.FocusEvent<HTMLInputElement>);
    };

    const isFormValid = useMemo(() => {
        if (!formData || jurisdictionError) {
            return false;
        }
        const { name, idNumber, tscNumber, phoneNumber, region, county, subCounty, subjects } = formData;
        const finalZoneName = selectedZone === 'Other' ? otherZoneName.trim() : selectedZone;

        if (!name || !idNumber || !tscNumber || !phoneNumber || !schoolInput.trim() || !region || !county || !subCounty || !finalZoneName || !subjects || subjects.length === 0) {
            return false;
        }

        const hasNoErrors = Object.values(errors).every(e => !e);
        if (!hasNoErrors) return false;
        
        if (!/^\d{7,8}$/.test(idNumber)) return false;
        if (!/^\d{5,7}$/.test(tscNumber)) return false;
        if (!/^0\d{9}$/.test(phoneNumber)) return false;

        return true;
    }, [formData, schoolInput, selectedZone, otherZoneName, errors, jurisdictionError]);


    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!isFormValid || !formData) {
            showNotification('Please fill all required fields and correct any errors.', 'error');
            return;
        }
        
        const finalSchoolName = schoolInput.trim();
        // FIX: The variable `finalZoneName` was used in its own initializer. It should use `selectedZone` for the 'else' case.
        const finalZoneName = selectedZone === 'Other' ? toTitleCase(otherZoneName.trim()) : selectedZone;
        
        const schoolLocationToSave: SchoolLocation = {
            school: finalSchoolName,
            region: formData.region || '',
            county: formData.county || '',
            subCounty: formData.subCounty || '',
            zone: finalZoneName,
        };

        if (schoolLocationToSave.school && schoolLocationToSave.region && schoolLocationToSave.county && schoolLocationToSave.subCounty && schoolLocationToSave.zone) {
            addSchoolData(schoolLocationToSave);
        }
        
        const updatedUser = { ...formData, school: finalSchoolName, zone: finalZoneName };
        onSave(updatedUser);
    };

    if (!isOpen || !formData) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-secondary dark:text-accent-green">Complete Your Profile</h2>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Please provide your details to continue.</p>
                </div>
                <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">Personal Information</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="name" className="block mb-1 font-medium text-text-light dark:text-text-dark">Full Name <span className="text-red-500">*</span></label>
                                <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleTextChange} onBlur={handleFieldBlur} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600" />
                                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                            </div>
                             <div>
                                <label htmlFor="idNumber" className="block mb-1 font-medium text-text-light dark:text-text-dark">ID Number <span className="text-red-500">*</span></label>
                                <input type="text" name="idNumber" id="idNumber" value={formData.idNumber || ''} onChange={handleTextChange} onBlur={handleFieldBlur} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600" />
                                {errors.idNumber && <p className="text-red-500 text-sm mt-1">{errors.idNumber}</p>}
                            </div>
                            <div>
                                <label htmlFor="tscNumber" className="block mb-1 font-medium text-text-light dark:text-text-dark">TSC/Service Number <span className="text-red-500">*</span></label>
                                <input type="text" name="tscNumber" id="tscNumber" value={formData.tscNumber || ''} onChange={handleTextChange} onBlur={handleFieldBlur} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600" />
                                {errors.tscNumber && <p className="text-red-500 text-sm mt-1">{errors.tscNumber}</p>}
                            </div>
                            <div>
                                <label htmlFor="phoneNumber" className="block mb-1 font-medium text-text-light dark:text-text-dark">Phone Number <span className="text-red-500">*</span></label>
                                <input type="tel" name="phoneNumber" id="phoneNumber" value={formData.phoneNumber || ''} onChange={handleTextChange} onBlur={handleFieldBlur} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600" />
                                {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                        <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">Professional Information</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="subjects" className="block mb-1 font-medium text-text-light dark:text-text-dark">Teaching Subjects / Area of Expertise <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="subjects"
                                    id="subjects"
                                    value={subjectsInput}
                                    onChange={handleSubjectsInputChange}
                                    onBlur={handleSubjectsBlur}
                                    placeholder="Enter subjects, separated by commas, e.g., Physics, Chemistry"
                                    required
                                    className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600"
                                />
                                {errors.subjects && <p className="text-red-500 text-sm mt-1">{errors.subjects}</p>}
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4 border p-4 rounded-md dark:border-gray-700">
                         <legend className="px-2 font-semibold text-lg text-text-light dark:text-text-dark">School & Location</legend>
                         <div>
                            <label htmlFor="school-input" className="block mb-1 font-medium text-text-light dark:text-text-dark">School/Institution Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    id="school-input"
                                    name="school-input"
                                    type="text"
                                    value={schoolInput}
                                    onChange={handleSchoolInputChange}
                                    onFocus={() => setIsSchoolDropdownOpen(true)}
                                    onBlur={(e) => { handleSchoolInputBlur(); handleFieldBlur(e); }}
                                    placeholder="Type to search or add a new school"
                                    autoComplete="off"
                                    required
                                    className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600"
                                />
                                {jurisdictionError && <p className="text-red-500 text-sm mt-1">{jurisdictionError}</p>}
                                {errors['school-input'] && <p className="text-red-500 text-sm mt-1">{errors['school-input']}</p>}
                                {isSchoolDropdownOpen && filteredSchools.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-card-light dark:bg-card-dark border dark:border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                                        {filteredSchools.map(school => (
                                            <li
                                                key={school}
                                                className="px-4 py-2 hover:bg-primary/10 cursor-pointer text-text-light dark:text-text-dark"
                                                onMouseDown={() => handleSchoolSelect(school)}
                                            >
                                                {school}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
                             <div>
                                <label htmlFor="region" className="block mb-1 font-medium text-text-light dark:text-text-dark">Region <span className="text-red-500">*</span></label>
                                <select name="region" id="region" value={formData.region || ''} onChange={handleGeoChange} onBlur={handleFieldBlur} required disabled={Boolean((selectedSchoolInfo && selectedSchoolInfo.region) || (!!user?.region && !isJudgeOrCoordinator))} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">
                                    <option value="">Select Region</option>
                                    {Object.keys(geographicalData).sort().map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                 {errors.region && <p className="text-red-500 text-sm mt-1">{errors.region}</p>}
                            </div>
                            <div>
                                <label htmlFor="county" className="block mb-1 font-medium text-text-light dark:text-text-dark">County <span className="text-red-500">*</span></label>
                                <select name="county" id="county" value={formData.county || ''} onChange={handleGeoChange} onBlur={handleFieldBlur} required disabled={Boolean((selectedSchoolInfo && selectedSchoolInfo.county) || (!!user?.county && !isJudgeOrCoordinator) || !formData.region)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">
                                    <option value="">Select County</option>
                                    {counties.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {errors.county && <p className="text-red-500 text-sm mt-1">{errors.county}</p>}
                            </div>
                             <div>
                                <label htmlFor="subCounty" className="block mb-1 font-medium text-text-light dark:text-text-dark">Sub-County <span className="text-red-500">*</span></label>
                                <select name="subCounty" id="subCounty" value={formData.subCounty || ''} onChange={handleGeoChange} onBlur={handleFieldBlur} required disabled={Boolean((selectedSchoolInfo && selectedSchoolInfo.subCounty) || (!!user?.subCounty && !isJudgeOrCoordinator) || !formData.county)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">
                                    <option value="">Select Sub-County</option>
                                    {subCounties.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                </select>
                                {errors.subCounty && <p className="text-red-500 text-sm mt-1">{errors.subCounty}</p>}
                            </div>
                            <div>
                                <label htmlFor="zone" className="block mb-1 font-medium text-text-light dark:text-text-dark">Zone <span className="text-red-500">*</span></label>
                                <select name="zone" id="zone" value={selectedZone} onChange={handleZoneChange} onBlur={handleFieldBlur} required disabled={Boolean((selectedSchoolInfo && selectedSchoolInfo.zone) || !formData.subCounty)} className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">
                                    <option value="">Select Zone</option>
                                    {zones.map(z => <option key={z} value={z}>{z}</option>)}
                                    {!((selectedSchoolInfo && selectedSchoolInfo.zone)) && <option value="Other">-- Other (Please specify) --</option>}
                                </select>
                                {errors.zone && <p className="text-red-500 text-sm mt-1">{errors.zone}</p>}
                            </div>
                            {selectedZone === 'Other' && !((selectedSchoolInfo && selectedSchoolInfo.zone)) && (
                                 <div className="md:col-span-2">
                                    <label htmlFor="otherZoneName" className="block mb-1 font-medium text-text-light dark:text-text-dark">Specify Zone Name <span className="text-red-500">*</span></label>
                                    <input type="text" id="otherZoneName" name="otherZoneName" value={otherZoneName} onChange={(e) => { setOtherZoneName(e.target.value); if(errors.otherZoneName) setErrors(prev => ({...prev, otherZoneName: ''})) }} onBlur={handleFieldBlur} required placeholder="Enter zone name" className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600" />
                                    {errors.otherZoneName && <p className="text-red-500 text-sm mt-1">{errors.otherZoneName}</p>}
                                </div>
                            )}
                         </div>
                    </fieldset>
                    
                    <div className="flex justify-end gap-4 pt-4 flex-shrink-0">
                        {!isForced && <Button type="button" variant="ghost">Skip for Now</Button>}
                        <Button type="submit" disabled={!isFormValid}>Save & Continue</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfileModal;