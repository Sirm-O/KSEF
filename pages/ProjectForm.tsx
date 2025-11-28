import React, { useState, useContext, useEffect, FormEvent, useMemo } from 'react';
// FIX: Replaced namespace import for react-router-dom with named imports to resolve module export errors.
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
// FIX: Add ProjectStatus import to resolve missing property error.
import { Project, ProjectStatus } from '../types';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import AbstractSubmission from '../components/AbstractSubmission';

// Helper function to generate a short, unique-ish hash from a string
const generateSchoolCode = (schoolName: string): string => {
    if (!schoolName) return 'XXXX';
    let hash = 0;
    for (let i = 0; i < schoolName.length; i++) {
        const char = schoolName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    // Convert to a base36 string (numbers + letters) and take a portion of it.
    // Pad with 'X' to ensure it's always 4 characters.
    const code = Math.abs(hash).toString(36).substring(0, 4).toUpperCase();
    return code.padEnd(4, 'X');
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


const ProjectForm: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { user, projects, addProject, updateProject, submissionDeadline, activeEdition, isHistoricalView, isJudgingStarted, editions } = useContext(AppContext);

    const isEditing = Boolean(projectId);
    const isPastDeadline = useMemo(() => submissionDeadline && new Date() > new Date(submissionDeadline), [submissionDeadline]);
    const [isLocked, setIsLocked] = useState(false);

    const initialFormData: Omit<Project, 'id' | 'currentLevel' | 'isEliminated'> = {
        title: '',
        category: '',
        projectRegistrationNumber: 'Set automatically on save',
        region: '',
        county: '',
        subCounty: '',
        zone: '',
        school: user?.school || '',
        students: [''],
        patronId: user?.id || '',
        status: ProjectStatus.NOT_STARTED,
        edition_id: activeEdition?.id || 0,
    };

    const [formData, setFormData] = useState<Omit<Project, 'id' | 'currentLevel' | 'isEliminated'>>(initialFormData);
    const [error, setError] = useState('');
    const [selectedCategoryDescription, setSelectedCategoryDescription] = useState('');

    const categoriesWithDescriptions = [
        { name: "Mathematical Science", description: "Encompasses areas like Algebra, Analysis, Applied Mathematics, Geometry, Probability & Statistics, and related topics." },
        { name: "Physics", description: "Covers Astronomy, Atoms, Molecules, Solids, Instrumentation & Electronics, Magnetism & Electromagnetism, Particle Physics, Optics, Lasers, and Theoretical Physics." },
        { name: "Computer Science", description: "Includes Algorithms, Databases, Artificial Intelligence, Networking & Communications, Computational Science, Graphics, Computer Systems, Operating Systems, Programming, and Software Engineering." },
        { name: "Chemistry", description: "Involves Analytical, General, Inorganic, Organic, and Physical Chemistry." },
        { name: "Biology and Biotechnology", description: "Covers Cellular Biology, Molecular Genetics, Immunology, Antibiotics, Antimicrobials, Bacteriology, Virology, Medicine & Health Sciences, and Photosynthesis." },
        { name: "Energy and Transportation", description: "Encompasses Aerospace, Alternative Fuels, Fossil Fuel Energy, Renewable Energy, Space, Air & Marine, Solar, Energy Conservation, and similar sustainability topics." },
        { name: "Environmental Science and Management", description: "Focuses on Bioremediation, Ecosystems Management, Environmental Engineering, Land Resource Management, Recycling, Waste Management, Pollution, Blue Economy, Soil Conservation, and Landscaping." },
        { name: "Agriculture", description: "Covers Agronomy, Plant Science & Systematics, Plant Evolution, Animal Sciences (e.g., Animal Husbandry), and Ecology." },
        { name: "Food Technology, Textiles & Home Economics", description: "Includes Food Product Development, Process Design, Food Engineering, Food Microbiology, Food Packaging & Preservation, Food Safety, Diet, Textile Design, Interior Design, and Decoration." },
        { name: "Engineering", description: "Involves Design, Building, Engine & Machine Use, Structures, Apparatus, Manufacturing Processes, Aeronautical Engineering, Vehicle Development, and New Product Development." },
        { name: "Technology and Applied Technology", description: "Focuses on Appropriate Technology, Innovations in Science & Industry, Knowledge Economy, and Research & Development." },
        { name: "Behavioral Science", description: "Encompasses Psychology, Animal Conservation, Behavior Change, and Disaster & Stress Response Management." },
        { name: "Robotics", description: "Involves the conception, engineering, design, manufacture, and operation of robots, including automation and AI integration." }
    ].sort((a, b) => a.name.localeCompare(b.name));

    const [analysisResult, setAnalysisResult] = useState<{ ai: any, plagiarism: any } | null>(null);

    useEffect(() => {
        if (isEditing) {
            const projectToEdit = projects.find(p => p.id === projectId);
            if (projectToEdit) {
                if (projectToEdit.status !== ProjectStatus.NOT_STARTED &&
                    projectToEdit.status !== ProjectStatus.WAITING &&
                    projectToEdit.status !== ProjectStatus.AWAITING_APPROVAL &&
                    projectToEdit.status !== ProjectStatus.REJECTED) {
                    setIsLocked(true);
                } else {
                    setIsLocked(false);
                }
                setFormData(projectToEdit);
                const description = categoriesWithDescriptions.find(c => c.name === projectToEdit.category)?.description || '';
                setSelectedCategoryDescription(description);
            }
        } else if (user) {
            // If creating a new project, pre-fill with patron's data
            const patronGeoData = {
                region: user.region || '',
                county: user.county || '',
                subCounty: user.subCounty || '',
                zone: user.zone || '',
                school: user.school || '',
            };
            setFormData(prev => ({
                ...prev,
                ...patronGeoData,
                edition_id: activeEdition?.id || 0, // Ensure edition_id is set
            }));
        }
    }, [isEditing, projectId, projects, user, activeEdition]);

    // Auto-generate registration number for new projects
    useEffect(() => {
        if (!isEditing && formData.category && formData.school && activeEdition) {
            const categoryMap: { [key: string]: string } = {
                "Mathematical Science": "MTH",
                "Physics": "PHY",
                "Computer Science": "CSC",
                "Chemistry": "CHM",
                "Biology and Biotechnology": "BIO",
                "Energy and Transportation": "ENT",
                "Environmental Science and Management": "EVS",
                "Agriculture": "AGR",
                "Food Technology, Textiles & Home Economics": "FTH",
                "Engineering": "ENG",
                "Technology and Applied Technology": "TEC",
                "Behavioral Science": "BEH",
                "Robotics": "RBT"
            };
            const code = categoryMap[formData.category] || 'GEN';
            const year = activeEdition.year;
            const schoolCode = generateSchoolCode(formData.school);

            const existingCount = projects.filter(p =>
                p.school.toLowerCase() === formData.school.toLowerCase() &&
                p.category === formData.category &&
                p.edition_id === activeEdition.id
            ).length;

            const projectNumber = existingCount + 1;
            const regNumber = `${code}-${year}-${schoolCode}-${projectNumber}`;
            setFormData(prev => ({ ...prev, projectRegistrationNumber: regNumber }));
        }
    }, [formData.category, formData.school, isEditing, projects, activeEdition]);

    // Validation for project limit
    useEffect(() => {
        if (!formData.school || !formData.category || !activeEdition) {
            setError('');
            return;
        }

        const projectsForSchoolAndCategory = projects.filter(p =>
            p.school.toLowerCase() === formData.school.toLowerCase() &&
            p.category === formData.category &&
            p.id !== projectId &&
            p.edition_id === activeEdition.id
        );

        if (projectsForSchoolAndCategory.length >= 4) {
            setError(`Limit reached: This school has already registered 4 projects in the "${formData.category}" category for this edition.`);
        } else {
            setError('');
        }
    }, [formData.category, formData.school, projects, projectId, activeEdition]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        setFormData(prev => {
            if (!prev) return initialFormData;

            const newFormData = { ...prev, [name]: value };

            if (name === 'category') {
                const description = categoriesWithDescriptions.find(c => c.name === value)?.description || '';
                setSelectedCategoryDescription(description);
            }

            return newFormData;
        });
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: toTitleCase(value) }));
    };

    const handleStudentChange = (index: number, value: string) => {
        const newStudents = [...formData.students];
        newStudents[index] = value;
        setFormData(prev => ({ ...prev, students: newStudents }));
    };

    const handleStudentBlur = (index: number, value: string) => {
        const newStudents = [...formData.students];
        newStudents[index] = toTitleCase(value);
        setFormData(prev => ({ ...prev, students: newStudents }));
    };

    const addStudentInput = () => {
        if (formData.students.length < 2) {
            setFormData(prev => ({ ...prev, students: [...prev.students, ''] }));
        }
    }

    const removeStudentInput = (index: number) => {
        if (formData.students.length > 1) {
            const newStudents = formData.students.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, students: newStudents }));
        }
    }

    const handleAnalysisComplete = (abstract: string, aiResult: any, plagiarismResult: any) => {
        setFormData(prev => ({
            ...prev,
            abstract,
            aiAnalysis: aiResult,
            plagiarismScore: plagiarismResult.score,
            plagiarismDetails: plagiarismResult.details
        }));
        setAnalysisResult({ ai: aiResult, plagiarism: plagiarismResult });
    };

    const handleAcceptSuggestions = () => {
        if (analysisResult?.ai) {
            setFormData(prev => ({
                ...prev,
                title: analysisResult.ai.titleSuggestion || prev.title,
                category: analysisResult.ai.categorySuggestion || prev.category
            }));
            // Update description for the new category
            if (analysisResult.ai.categorySuggestion) {
                const description = categoriesWithDescriptions.find(c => c.name === analysisResult.ai.categorySuggestion)?.description || '';
                setSelectedCategoryDescription(description);
            }
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (error) {
            alert(`Error: Cannot save. ${error}`);
            return;
        }

        if (!formData.abstract || formData.abstract.trim().length < 50) {
            alert("Error: Please provide a detailed abstract (at least 50 characters) before submitting.");
            return;
        }

        // Determine status: If new or editing, set to AWAITING_APPROVAL unless it's already approved/judged (which is handled by isLocked)
        // Actually, for edits, if they change abstract, maybe it should go back to approval? 
        // For now, let's enforce AWAITING_APPROVAL for all submissions from this form if it's not already locked.
        const statusToSet = ProjectStatus.AWAITING_APPROVAL;

        const projectData = {
            ...(formData as Project),
            id: projectId || undefined, // ID will be generated by addProject if undefined
            status: statusToSet
        };

        if (isEditing && projectId) {
            updateProject(projectData);
        } else {
            addProject(projectData);
        }
        navigate('/dashboard');
    };

    if (isHistoricalView) {
        return (
            <Card className="text-center">
                <AlertTriangle className="mx-auto w-12 h-12 text-amber-500 mb-4" />
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Historical View Mode</h2>
                <p className="mt-2 text-text-muted-light dark:text-text-muted-dark">
                    You are viewing a past edition. Projects cannot be created or edited in historical view mode.
                </p>
                <Button onClick={() => navigate('/dashboard')} className="mt-6">Back to Dashboard</Button>
            </Card>
        );
    }

    if (isJudgingStarted && !isEditing) {
        return (
            <Card className="text-center">
                <AlertTriangle className="mx-auto w-12 h-12 text-amber-500 mb-4" />
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Project Registration Locked</h2>
                <p className="mt-2 text-text-muted-light dark:text-text-muted-dark">
                    New projects cannot be registered because the judging process for this edition has already begun.
                </p>
                <Button onClick={() => navigate('/dashboard')} className="mt-6">Back to Dashboard</Button>
            </Card>
        );
    }

    if (!activeEdition && !isEditing) {
        return (
            <Card className="text-center">
                <AlertTriangle className="mx-auto w-12 h-12 text-amber-500 mb-4" />
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">No Active Competition Edition</h2>
                <p className="mt-2 text-text-muted-light dark:text-text-muted-dark">
                    A Super Admin must create and activate a competition edition before any projects can be created.
                </p>
                <Button onClick={() => navigate('/dashboard')} className="mt-6">Back to Dashboard</Button>
            </Card>
        );
    }

    return (
        <Card>
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-6">
                {isEditing ? 'Edit Project' : 'Create New Project'}
            </h2>
            {isLocked && (
                <div className="p-4 rounded-md mb-6 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Project Locked</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            This project cannot be edited because judging is in progress or has been completed.
                        </p>
                    </div>
                </div>
            )}
            {formData.rejectionReason && (
                <div className="p-4 rounded-md mb-6 bg-red-100 dark:bg-red-900/40 border border-red-400 flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-red-800 dark:text-red-200">Project Rejected</h3>
                        <p className="text-sm text-red-700 dark:text-red-400">
                            Reason: {formData.rejectionReason}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                            You can edit the project details and resubmit.
                        </p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset disabled={isPastDeadline || isLocked || (isJudgingStarted && !isEditing)}>

                    {/* --- ABSTRACT SUBMISSION --- */}
                    <div className="mb-8">
                        <AbstractSubmission
                            initialAbstract={formData.abstract}
                            existingProjects={projects}
                            editions={editions}
                            onAnalysisComplete={handleAnalysisComplete}
                            onAbstractChange={(text) => setFormData(prev => ({ ...prev, abstract: text }))}
                        />
                        {analysisResult && (
                            <div className="mt-4 flex justify-end">
                                <Button type="button" variant="secondary" onClick={handleAcceptSuggestions} className="text-sm">
                                    Accept AI Suggestions (Autofill)
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* --- MANUAL ENTRY FIELDS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="title" className="block mb-1 font-medium text-text-light dark:text-text-dark">Project Title</label>
                            <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} onBlur={handleBlur} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600" />
                        </div>
                        <div>
                            <label htmlFor="category" className="block mb-1 font-medium text-text-light dark:text-text-dark">Category</label>
                            <select name="category" id="category" value={formData.category} onChange={handleChange} required className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600">
                                <option value="" disabled>Select a category</option>
                                {categoriesWithDescriptions.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                            </select>
                            {selectedCategoryDescription && (
                                <div className="mt-2 p-3 bg-primary/10 text-primary-dark dark:text-primary rounded-md border border-primary/30">
                                    <p className="font-semibold text-sm">Category Description:</p>
                                    <p className="text-sm">{selectedCategoryDescription}</p>
                                </div>
                            )}
                            {error && (
                                <div className="flex items-center gap-2 text-red-500 text-sm mt-2 p-2 bg-red-500/10 rounded-md">
                                    <AlertTriangle className="w-4 h-4" />
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Student Participants</h3>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">A project must have 1 or 2 student participants.</p>
                        <div className="space-y-4">
                            {formData.students.map((student, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder={`Student ${index + 1} Full Name`}
                                        value={student}
                                        onChange={(e) => handleStudentChange(index, e.target.value)}
                                        onBlur={(e) => handleStudentBlur(index, e.target.value)}
                                        required
                                        className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600"
                                    />
                                    {formData.students.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeStudentInput(index)}
                                            className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 p-2"
                                            aria-label="Remove student"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={addStudentInput}
                            disabled={formData.students.length >= 2}
                            title={formData.students.length >= 2 ? 'A project can have a maximum of 2 students.' : 'Add another student'}
                            className="mt-4 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Another Student
                        </Button>
                    </div>

                    {/* --- AUTO-FILLED FIELDS --- */}
                    <div className="mt-6 pt-6 border-t dark:border-gray-700 space-y-6">
                        <div>
                            <label htmlFor="projectRegistrationNumber" className="block mb-1 font-medium text-text-light dark:text-text-dark">Project Registration Number</label>
                            <input type="text" name="projectRegistrationNumber" id="projectRegistrationNumber" value={formData.projectRegistrationNumber} readOnly className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700/50 text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 cursor-not-allowed" />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Project Location & School</h3>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                This information is automatically set based on your profile and cannot be changed here. To update your location, please <Link to="/profile" className="text-primary underline">edit your profile</Link>.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">School</label>
                                    <p className="mt-1 p-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-md text-text-light dark:text-text-dark">{formData.school || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Region</label>
                                    <p className="mt-1 p-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-md text-text-light dark:text-text-dark">{formData.region || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">County</label>
                                    <p className="mt-1 p-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-md text-text-light dark:text-text-dark">{formData.county || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Sub-County</label>
                                    <p className="mt-1 p-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-md text-text-light dark:text-text-dark">{formData.subCounty || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Zone</label>
                                    <p className="mt-1 p-2 w-full bg-gray-100 dark:bg-gray-700/50 rounded-md text-text-light dark:text-text-dark">{formData.zone || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </fieldset>
                <div className="flex justify-end gap-4">
                    <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                    <Button type="submit" disabled={isPastDeadline || !!error || isLocked || !formData.abstract || formData.abstract.length < 50}>
                        {isEditing ? 'Save Changes' : 'Submit Project'}
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default ProjectForm;