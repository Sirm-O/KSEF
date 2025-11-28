import { GoogleGenAI, Type } from "@google/genai";

// This is a Vercel serverless function.
// It acts as a secure proxy to the Google Gemini API.

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required in the request body.' });
    }

    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        console.error('API_KEY environment variable not set.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }
    
    const ai = new GoogleGenAI({apiKey: API_KEY});

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    comments: { type: Type.STRING },
                    recommendations: { type: Type.STRING }
                }
            }
        }
    });

    const responseText = response.text;

    if (!responseText) {
        console.error('Invalid response from Gemini API:', response);
        return res.status(500).json({ error: 'Failed to parse response from AI service.' });
    }
    
    // The response text is a JSON string, so we need to parse it.
    const feedback = JSON.parse(responseText);
    
    return res.status(200).json(feedback);

  } catch (error: any) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}
