import React, { useState } from 'react';
import { Upload, FileText, Check, AlertTriangle, RefreshCw, Wand2 } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { extractTextFromFile } from '../utils/fileParser';
import { analyzeAbstract, AIAnalysisResult } from '../utils/aiService';
import { checkPlagiarism, PlagiarismResult } from '../utils/plagiarismService';
import { Project, Edition } from '../types';

interface AbstractSubmissionProps {
    initialAbstract?: string;
    existingProjects: Project[];
    editions: Edition[];
    onAnalysisComplete: (abstract: string, aiResult: AIAnalysisResult, plagiarismResult: PlagiarismResult) => void;
    onAbstractChange: (abstract: string) => void;
    geminiApiKey?: string | null;
}

const AbstractSubmission: React.FC<AbstractSubmissionProps> = ({ initialAbstract = '', existingProjects, editions, onAnalysisComplete, onAbstractChange, geminiApiKey }) => {
    const [abstract, setAbstract] = useState(initialAbstract);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ ai: AIAnalysisResult, plagiarism: PlagiarismResult } | null>(null);
    const [error, setError] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsAnalyzing(true);
            setError('');
            const text = await extractTextFromFile(file);
            setAbstract(text);
            onAbstractChange(text);
        } catch (err: any) {
            setError(err.message || 'Failed to read file');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyze = async () => {
        if (!abstract || abstract.length < 50) {
            setError('Abstract is too short to analyze. Please provide at least 50 characters.');
            return;
        }

        setIsAnalyzing(true);
        setError('');

        try {
            // 1. AI Analysis
            const aiRes = await analyzeAbstract(abstract, geminiApiKey);

            // 2. Plagiarism Check
            const plagiarismRes = checkPlagiarism(abstract, existingProjects, editions);

            setAnalysisResult({ ai: aiRes, plagiarism: plagiarismRes });
            onAnalysisComplete(abstract, aiRes, plagiarismRes);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Analysis failed. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="block mb-2 font-medium text-text-light dark:text-text-dark">Project Abstract</label>
                <div className="flex gap-4 mb-2">
                    <div className="relative flex-1">
                        <textarea
                            value={abstract}
                            onChange={(e) => { setAbstract(e.target.value); onAbstractChange(e.target.value); }}
                            className="w-full h-40 p-3 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary"
                            placeholder="Paste your abstract here or upload a file..."
                        />
                        <div className="absolute bottom-2 right-2">
                            <input
                                type="file"
                                id="abstract-upload"
                                accept=".pdf,.docx"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <label htmlFor="abstract-upload" className="cursor-pointer p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors inline-block" title="Upload PDF or Word Doc">
                                <Upload size={18} className="text-text-muted-light dark:text-text-muted-dark" />
                            </label>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    Supported formats: Text, PDF, Word (.docx). Minimum 50 characters.
                </p>
            </div>

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !abstract}
                    className="flex items-center gap-2"
                >
                    {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Abstract'}
                </Button>
            </div>

            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md flex items-center gap-2">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {analysisResult && (
                <Card className="bg-gray-50 dark:bg-gray-800/50 border-l-4 border-primary">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <FileText className="text-primary" /> Analysis Results
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* AI Detection */}
                        <div>
                            <p className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">AI Generated Content</p>
                            <div className="flex items-center gap-3">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full ${analysisResult.ai.aiScore > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: `${analysisResult.ai.aiScore}%` }}
                                    ></div>
                                </div>
                                <span className={`font-bold ${analysisResult.ai.aiScore > 50 ? 'text-red-500' : 'text-green-500'}`}>
                                    {analysisResult.ai.aiScore}%
                                </span>
                            </div>
                        </div>

                        {/* Plagiarism */}
                        <div>
                            <p className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Plagiarism Check</p>
                            <div className="flex items-center gap-3">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full ${analysisResult.plagiarism.score > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: `${analysisResult.plagiarism.score}%` }}
                                    ></div>
                                </div>
                                <span className={`font-bold ${analysisResult.plagiarism.score > 80 ? 'text-red-500' : 'text-green-500'}`}>
                                    {analysisResult.plagiarism.score}%
                                </span>
                            </div>
                            {analysisResult.plagiarism.details && (
                                <div className="mt-2 text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                    <p className="font-semibold text-red-600 dark:text-red-400">Potential Match Found:</p>
                                    <p>Title: {analysisResult.plagiarism.details.matchedProjectTitle}</p>
                                    <p>School: {analysisResult.plagiarism.details.school}</p>
                                    <p>Similarity: {analysisResult.plagiarism.details.similarity}%</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="font-medium mb-2">AI Suggestions:</p>
                        <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span className="text-sm text-text-muted-light dark:text-text-muted-dark w-24">Title:</span>
                                <span className="font-medium flex-1">{analysisResult.ai.titleSuggestion}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span className="text-sm text-text-muted-light dark:text-text-muted-dark w-24">Category:</span>
                                <span className="font-medium flex-1">{analysisResult.ai.categorySuggestion}</span>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default AbstractSubmission;
