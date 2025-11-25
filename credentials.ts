// --- IMPORTANT: ACTION REQUIRED ---
// This application requires credentials to function.
// Please follow the on-screen instructions that appear when you first run the app,
// or refer to the steps below.

// --- Google Cloud Credentials (for Google Sheets & Drive) ---
// These credentials allow the application to securely save and load your sales data
// to a private Google Sheet in your own Google Drive.

// INSTRUCTIONS:
// 1. Go to the Google Cloud Console: https://console.cloud.google.com/
// 2. Create or select a project.
// 3. Enable the "Google Sheets API" and "Google Drive API".
// 4. Go to "APIs & Services > Credentials".

// --- TROUBLESHOOTING NOTE ---
// The Google error message "Access blocked... for developer of SALES TRACKER" refers
// to the "App name" you set on the "OAuth consent screen".
// Please ensure that the GOOGLE_CLIENT_ID you paste below was created under that
// same project and is associated with that consent screen.
// ---

// 5. Create an "API key" and paste its value here.
export const GOOGLE_API_KEY = 'AIzaSyAv5gqd0hSgZ24A1kfihVRsh3zUSumigKg'; 

// 6. Create an "OAuth 2.0 Client ID" for a "Web application".
//    - For "Authorized JavaScript origins" and "Authorized redirect URIs", add the URL where you run this application (e.g., the URL in your browser's address bar or http://localhost:XXXX for local development).
//    - Copy the "Client ID" and paste it here.
export const GOOGLE_CLIENT_ID = '1043821041487-jfhg5tn44qo5t820jugg713cj4a44vg3.apps.googleusercontent.com';