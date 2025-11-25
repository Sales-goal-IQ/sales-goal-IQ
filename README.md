# Sales-Goal-IQ — Firebase Auth + Firestore (Clean Backend)

This project snapshot is based on your last working UI build.
Changes in this version:

- All Supabase usage removed (no Supabase dependencies, no Supabase env)
- Firebase Auth (email/password) + Firestore are used via `services/firebaseClient.ts` and `services/firebaseService.ts`
- No Gemini / AI features wired in (Vite config cleaned)
- UI and page flow preserved exactly as before

Run locally:

```bash
npm install
npm run dev
```

---

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1lghTtR_g1g0XUCgwRBrE74FLXIdLBRxa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
