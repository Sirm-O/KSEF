import { Project, Edition } from '../types';

export interface PlagiarismResult {
    score: number;
    details?: {
        matchedProjectTitle: string;
        school: string;
        edition: string;
        similarity: number;
    };
}

// Simple Levenshtein distance for similarity (or Jaccard index for better performance on long text)
// For this implementation, we'll use a simplified word overlap (Jaccard Index) for efficiency on client-side
const calculateSimilarity = (text1: string, text2: string): number => {
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return (intersection.size / union.size) * 100;
};

export const checkPlagiarism = (abstract: string, existingProjects: Project[], editions: Edition[]): PlagiarismResult => {
    let maxSimilarity = 0;
    let bestMatch: Project | null = null;

    // Filter out projects with empty abstracts
    const validProjects = existingProjects.filter(p => p.abstract && p.abstract.length > 50);

    for (const project of validProjects) {
        if (!project.abstract) continue;

        const similarity = calculateSimilarity(abstract, project.abstract);
        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatch = project;
        }
    }

    // If match is > 80%, return details
    if (maxSimilarity >= 80 && bestMatch) {
        const matchedEdition = editions.find(e => e.id === bestMatch!.edition_id);
        const editionDisplay = matchedEdition ? `${matchedEdition.name} (${matchedEdition.year})` : `Edition ${bestMatch.edition_id}`;

        return {
            score: Math.round(maxSimilarity),
            details: {
                matchedProjectTitle: bestMatch.title,
                school: bestMatch.school,
                edition: editionDisplay,
                similarity: Math.round(maxSimilarity)
            }
        };
    }

    return {
        score: Math.round(maxSimilarity)
    };
};
