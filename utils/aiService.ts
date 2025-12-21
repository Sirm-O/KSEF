import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

export interface AIAnalysisResult {
    aiScore: number;
    titleSuggestion: string;
    categorySuggestion: string;
}

export interface CommentGenerationResult {
    comments: string;
    recommendations: string;
}

const getApiKey = (dynamicKey?: string | null) => {
    // Priority: Dynamic Key > VITE_GEMINI_API_KEY > process.env.GEMINI_API_KEY
    if (dynamicKey) return dynamicKey;
    return import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
};

export const analyzeAbstract = async (abstract: string, dynamicApiKey?: string | null): Promise<AIAnalysisResult> => {
    const apiKey = getApiKey(dynamicApiKey);

    if (!apiKey) {
        console.error("Gemini API Key is missing");
        throw new Error("AI Service is not configured. Missing API Key.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-001",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    aiScore: { type: SchemaType.NUMBER, description: "Percentage likelihood of AI generation (0-100)" },
                    titleSuggestion: { type: SchemaType.STRING },
                    categorySuggestion: { type: SchemaType.STRING }
                }
            }
        }
    });

    const prompt = `
    Analyze the following project abstract for a high school science fair.
    1. Estimate the percentage likelihood that this text was AI-generated (0-100).
    2. Suggest a concise and scientific title for the project.
    3. Suggest the most appropriate category from this list: 
       Mathematical Science, Physics, Computer Science, Chemistry, Biology and Biotechnology, 
       Energy and Transportation, Environmental Science and Management, Agriculture, 
       Food Technology, Textiles & Home Economics, Engineering, Technology and Applied Technology, 
       Behavioral Science, Robotics.

    Abstract: "${abstract}"
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        if (!responseText) throw new Error("Empty response from AI");

        const parsed = JSON.parse(responseText);
        return {
            aiScore: parsed.aiScore,
            titleSuggestion: parsed.titleSuggestion,
            categorySuggestion: parsed.categorySuggestion
        };
    } catch (error) {
        console.error("AI Analysis failed:", error);
        throw error;
    }
};

export const generateJudgingComments = async (prompt: string, dynamicApiKey?: string | null): Promise<CommentGenerationResult> => {
    const apiKey = getApiKey(dynamicApiKey);

    if (!apiKey) {
        console.error("Gemini API Key is missing");
        throw new Error("AI Service is not configured. Missing API Key.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-001",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    comments: { type: SchemaType.STRING },
                    recommendations: { type: SchemaType.STRING }
                }
            }
        }
    });

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        if (!responseText) throw new Error("Empty response from AI");

        return JSON.parse(responseText);
    } catch (error) {
        console.error("AI Comment Generation failed:", error);
        throw error;
    }
};
