import { GoogleGenAI } from "@google/genai";
import { SalesStats } from '../types';

export const getSalesInsight = async (stats: SalesStats): Promise<string> => {
    try {
        const apiKey = process.env.API_KEY;

        if (!apiKey) {
            throw new Error('API_KEY is not configured. Please ensure it is set up in your environment variables.');
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

        const insightText = response.text;

        if (typeof insightText !== 'string') {
            console.error('Unexpected response format from Gemini API:', response);
            throw new Error('Received an unexpected response format from the AI.');
        }
        
        return insightText;

    } catch (error) {
        console.error("Error fetching sales insight from Gemini API:", error);
        
        let detailedError = 'An unexpected error occurred while fetching insights.';
        if (error instanceof Error) {
            const lowerCaseMessage = error.message.toLowerCase();
            
            if (lowerCaseMessage.includes('api key not valid')) {
                detailedError = 'The Gemini API reported that the API key is not valid. Please double-check it.';
            } else if (lowerCaseMessage.includes('billing')) {
                detailedError = 'The Gemini API request failed due to a billing issue. Please ensure that billing is enabled for the Google Cloud project associated with your API key.';
            } else if (lowerCaseMessage.includes('permission denied') || lowerCaseMessage.includes('api not enabled')) {
                detailedError = 'The Gemini API reported a permission error. Please ensure the Generative Language API is enabled in your Google Cloud project.';
            } else {
                 detailedError = `Failed to generate insight: ${error.message}`;
            }
        }
        
        throw new Error(detailedError);
    }
};
