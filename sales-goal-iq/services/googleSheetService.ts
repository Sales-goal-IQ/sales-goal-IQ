import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from '../credentials';
import { Sale, VehicleType } from '../types';

// The 'gapi' and 'google' objects are loaded from the script in index.html
declare const gapi: any;
declare const google: any;

const DISCOVERY_DOCS = [
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";
const SPREADSHEET_NAME = "Auto Sales Performance Tracker";
const SHEET_HEADERS = [
    "Date", "Customer Name", "New/Used", "Store", "Year", "Make", "Model",
    "Trade", "Front Gross", "Back Gross", "Commission", "Accessory", "Spiffs", "Trade Spiff"
];

let tokenClient: any;
let spreadsheetId: string | null = null;
let gapiInited = false;
let gisInited = false;

/**
 * A promise that resolves when the Google API client is loaded and ready.
 */
const gapiLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => gapi.load('client', resolve);
    script.onerror = () => reject(new Error('Failed to load GAPI script.'));
    document.body.appendChild(script);
});

/**
 * A promise that resolves when the Google Sign-In client is loaded and ready.
 */
const gsiLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GSI script.'));
    document.body.appendChild(script);
});

/**
 * Initializes the Google Identity Services (GIS) and Google API (GAPI) clients.
 * This function must be called before any other function in this module.
 */
export const initClient = async () => {
    // A basic check that the credentials look like they've been filled in.
    if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID || GOOGLE_API_KEY.startsWith('AIzaSy') === false) {
        throw new Error('Please add your valid API Key and Client ID to the credentials.ts file.');
    }

    // Wait for both scripts to be loaded to prevent race conditions.
    await Promise.all([gapiLoadPromise, gsiLoadPromise]);
    
    // Initialize the GAPI client with the API key and discovery documents.
    await gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;

    // Initialize the GIS token client.
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: () => {}, // Callback is handled by the Promise in signIn
    });
    gisInited = true;
};

/**
 * Signs the user in with Google and obtains an access token.
 */
export const signIn = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!gisInited || !gapiInited) {
            return reject(new Error('Google API client is not initialized.'));
        }

        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                return reject(new Error(`Google Sign-In error: ${resp.error}`));
            }
            // Set the token for all subsequent GAPI requests.
            gapi.client.setToken(resp);
            resolve();
        };

        if (gapi.client.getToken() === null) {
            // Prompt the user to select an account and grant consent for scopes.
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // Skip display of account chooser and consent dialog.
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
};

/**
 * Signs the user out.
 */
export const signOut = () => {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken(null);
            spreadsheetId = null;
        });
    }
};

/**
 * Checks if the user has a valid, non-expired access token.
 */
export const isAuthenticated = (): boolean => {
    const token = gapi.client.getToken();
    return token !== null;
};


const findOrCreateSpreadsheet = async (): Promise<string> => {
    if (spreadsheetId) return spreadsheetId;

    const response = await gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${SPREADSHEET_NAME}' and trashed=false`,
        fields: 'files(id, name)',
    });

    if (response.result.files && response.result.files.length > 0) {
        spreadsheetId = response.result.files[0].id;
        return spreadsheetId!;
    }

    const spreadsheet = await gapi.client.sheets.spreadsheets.create({
        properties: {
            title: SPREADSHEET_NAME
        }
    });

    spreadsheetId = spreadsheet.result.spreadsheetId;

    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [SHEET_HEADERS]
        }
    });

    return spreadsheetId!;
};

export const loadSales = async (): Promise<{ salesData: Omit<Sale, 'id' | 'cumulativeGross'>[], rawData: any[][] }> => {
    const sheetId = await findOrCreateSpreadsheet();
    const range = 'Sheet1!A2:N';

    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
    });

    const values = response.result.values || [];

    const salesData: Omit<Sale, 'id' | 'cumulativeGross'>[] = values.map((row: any[]) => ({
        date: row[0] || '',
        customerName: row[1] || '',
        newOrUsed: row[2] === 'New' ? VehicleType.NEW : VehicleType.USED,
        store: row[3] || '',
        year: parseInt(row[4], 10) || 0,
        make: row[5] || '',
        model: row[6] || '',
        trade: row[7] === 'TRUE',
        frontGross: parseFloat(row[8]) || 0,
        backGross: parseFloat(row[9]) || 0,
        commission: parseFloat(row[10]) || 0,
        accessory: parseFloat(row[11]) || 0,
        spiffs: parseFloat(row[12]) || 0,
        tradeSpiff: parseFloat(row[13]) || 0,
    }));

    return { salesData, rawData: values };
};


export const addSale = async (sale: Omit<Sale, 'id' | 'cumulativeGross'>) => {
    const sheetId = await findOrCreateSpreadsheet();
    const values = [
        sale.date,
        sale.customerName,
        sale.newOrUsed,
        sale.store,
        sale.year,
        sale.make,
        sale.model,
        sale.trade,
        sale.frontGross,
        sale.backGross,
        sale.commission,
        sale.accessory,
        sale.spiffs,
        sale.tradeSpiff
    ];

    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A:N',
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [values]
        }
    });
};

export const updateSale = async (sale: Sale) => {
    const sheetId = await findOrCreateSpreadsheet();
    const range = `Sheet1!A${sale.id}:N${sale.id}`;

    const values = [
        sale.date,
        sale.customerName,
        sale.newOrUsed,
        sale.store,
        sale.year,
        sale.make,
        sale.model,
        sale.trade,
        sale.frontGross,
        sale.backGross,
        sale.commission,
        sale.accessory,
        sale.spiffs,
        sale.tradeSpiff
    ];

    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [values]
        }
    });
};