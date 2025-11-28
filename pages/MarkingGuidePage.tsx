import React from 'react';
import Card from '../components/ui/Card';
import { SCORE_SHEET } from '../constants';

const MarkingGuidePage: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">KSEF Marking Guide</h1>
            {SCORE_SHEET.map(section => (
                <Card key={section.id}>
                    <h2 className="text-xl font-bold text-secondary dark:text-accent-green">{section.title}</h2>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1 mb-4">{section.description}</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-700 text-text-muted-light dark:text-text-muted-dark">
                                <tr>
                                    <th className="px-4 py-3 text-left">Criteria</th>
                                    <th className="px-4 py-3 text-left">Details</th>
                                    <th className="px-4 py-3 text-center">Max Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {section.criteria.map(criterion => (
                                    <tr key={criterion.id} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-3 font-medium text-text-light dark:text-text-dark">{criterion.text}</td>
                                        <td className="px-4 py-3 text-text-muted-light dark:text-text-muted-dark">{criterion.details}</td>
                                        <td className="px-4 py-3 text-center font-bold">{criterion.maxScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default MarkingGuidePage;