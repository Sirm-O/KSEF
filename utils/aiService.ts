import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

export interface AIAnalysisResult {
    aiScore: number;
    titleSuggestion: string;
    categorySuggestion: string;
}

export const analyzeAbstract = async (abstract: string): Promise<AIAnalysisResult> => {
    if (!API_KEY) {
        console.error("Gemini API Key is missing");
        throw new Error("AI Service is not configured. Missing API Key.");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

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
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        aiScore: { type: Type.NUMBER, description: "Percentage likelihood of AI generation (0-100)" },
                        titleSuggestion: { type: Type.STRING },
                        categorySuggestion: { type: Type.STRING }
                    }
                }
            }
        });

        const responseText = response.text;
        if (!responseText) throw new Error("Empty response from AI");

        const result = JSON.parse(responseText);
        return {
            aiScore: result.aiScore,
            titleSuggestion: result.titleSuggestion,
            categorySuggestion: result.categorySuggestion
        };
    } catch (error) {
        console.error("AI Analysis failed:", error);
        // Fallback or rethrow
        throw error;
    }
};
