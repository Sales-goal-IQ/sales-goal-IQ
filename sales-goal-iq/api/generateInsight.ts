
// This file is adapted for the Netlify Functions runtime.

import { GoogleGenAI } from "@google/genai";

// By defining the type here, we make the function self-contained and avoid
// potential issues with module resolution during Netlify's build process.
interface SalesStats {
    totalSales: number;
    totalGross: number;
    totalBackGross: number;
    totalCommission: number;
    totalAccessories: number;
    totalSpiffs: number;
    totalTradeSpiffs: number;
    newVehicles: number;
    usedVehicles: number;
    avgCommission: number;
    totalTrades: number;
}


// The 'Handler' event type is specific to Netlify functions.
interface NetlifyEvent {
    httpMethod: string;
    body: string | null;
}

export const handler = async (event: NetlifyEvent) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    try {
        if (!event.body) {
             return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Request body is missing.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
        
        const { stats }: { stats: SalesStats } = JSON.parse(event.body);
        
        const apiKey = process.env.API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'CRITICAL: API_KEY is not configured on the server. Please check your Netlify Environment Variables.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
        
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const prompt = `
        Analyze the following auto sales performance data for a salesperson and provide a brief, actionable insight.
        Focus on one key area for improvement or a key strength. Keep the tone encouraging and professional.
        The output should be a short paragraph, no more than 3-4 sentences.

        Sales Data:
        - Total Sales: ${stats.totalSales} units
        - Total Gross Profit: $${stats.totalGross.toFixed(2)}
        - Total Commission: $${stats.totalCommission.toFixed(2)}
        - Average Commission per Sale: $${stats.avgCommission.toFixed(2)}
        - New vs. Used Ratio: ${stats.newVehicles} New / ${stats.usedVehicles} Used
        - Total Accessory Sales: $${stats.totalAccessories.toFixed(2)}
        - Total Spiffs: $${stats.totalSpiffs.toFixed(2)}
        - Total Trade Spiffs: $${stats.totalTradeSpiffs.toFixed(2)}

        Insight:
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        // Ensure the response has the text property before accessing it
        const insightText = response?.text;

        if (typeof insightText !== 'string') {
            console.error('Unexpected response format from Gemini API:', JSON.stringify(response, null, 2));
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Received an unexpected response format from the AI. Check Netlify function logs.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ insight: insightText }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        // Log the raw error for debugging in Netlify
        console.error('Raw error from Gemini API call:', error);
        
        let detailedError = 'An unexpected server error occurred.';
        if (error instanceof Error) {
            const lowerCaseMessage = error.message.toLowerCase();
            
            if (lowerCaseMessage.includes('api key not valid')) {
                detailedError = 'The Gemini API reported that the API key is not valid. Please double-check the key in your Netlify settings for typos or extra spaces.';
            } else if (lowerCaseMessage.includes('billing')) {
                detailedError = 'The Gemini API request failed due to a billing issue. Please ensure that billing is enabled for the Google Cloud project associated with your API key.';
            } else if (lowerCaseMessage.includes('permission denied') || lowerCaseMessage.includes('api not enabled')) {
                detailedError = 'The Gemini API reported a permission error. Please ensure the "Generative Language API" (or a similar Gemini API) is enabled in your Google Cloud project.';
            } else {
                 detailedError = `The server encountered an error: ${error.message}`;
            }
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: detailedError }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};
