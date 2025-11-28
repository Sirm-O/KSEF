import React, { useContext, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AppContext } from '../../context/AppContext';
import { User, Project, JudgeAssignment, UserRole } from '../../types';
import { ListChecks } from 'lucide-react';

type Section = 'Part A' | 'Part B & C';

// Helper to summarize a judge's assignments by category
const summarizeAssignments = (judgeId: string, assignments: JudgeAssignment[], projects: Project[]) => {
    const summary = new Map<string, Set<Section>>();
    const judgeAssignments = assignments.filter(a => a.judgeId === judgeId);

    for (const assignment of judgeAssignments) {
        const project = projects.find(p => p.id === assignment.projectId);
        if (project) {
            if (!summary.has(project.category)) {
                summary.set(project.category, new Set());
            }
            summary.get(project.category)!.add(assignment.assignedSection);
        }
    }
    return Array.from(summary.entries()).map(([category, sections]) => ({
        category,
        sections: Array.from(sections).sort()
    }));
};

interface JudgeAssignmentsViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    judge: User;
}

const JudgeAssignmentsViewModal: React.FC<JudgeAssignmentsViewModalProps> = ({ isOpen, onClose, judge }) => {
    const { projects, assignments } = useContext(AppContext);

    const isCoordinator = judge.roles.includes(UserRole.COORDINATOR);

    const judgeCategoryAssignments = useMemo(
        () => summarizeAssignments(judge.id, assignments, projects),
        [judge.id, assignments, projects]
    );

    const coordinatorAssignedCategory = useMemo(() => {
        if (!isCoordinator) return null;
        return judgeCategoryAssignments.length > 0 ? judgeCategoryAssignments[0].category : null;
    }, [isCoordinator, judgeCategoryAssignments]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Assignments for ${judge.name}`} size="lg">
            <div className="space-y-4">
                {judgeCategoryAssignments.length > 0 ? (
                    <div className="space-y-3">
                        {isCoordinator && coordinatorAssignedCategory ? (
                            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <p className="font-bold text-lg text-text-light dark:text-text-dark">{coordinatorAssignedCategory}</p>
                                <p className="text-sm text-primary font-semibold">Coordinating all sections</p>
                            </div>
                        ) : (
                            judgeCategoryAssignments.map(({ category, sections }) => (
                                <div key={category} className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <p className="font-bold text-lg text-text-light dark:text-text-dark">{category}</p>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        {sections.map(section => (
                                            <li key={section} className="font-medium text-text-light dark:text-text-dark ml-2">{section}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <ListChecks className="w-12 h-12 mx-auto text-gray-400" />
                        <h3 className="mt-2 text-lg font-medium text-text-light dark:text-text-dark">No Assignments Found</h3>
                        <p className="mt-1 text-sm text-text-muted-light dark:text-text-muted-dark">This user has not been assigned to any categories yet.</p>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default JudgeAssignmentsViewModal;