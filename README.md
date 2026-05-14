# ⚒️ Remix: Minecraft Mod Porter

Port Java Edition mods to Bedrock Add-ons directly on your iPad. Fetch assets from GitHub, generate Bedrock JSON, and export `.mcaddon` files.

## 🚀 How to Run on iPad (via GitHub Codespaces)

Since you are on an iPad, you don't need to install Node.js locally. You can use **GitHub Codespaces**:

1.  **Push code to GitHub**: Use the "Export to GitHub" or "Share" options.
2.  **Open Codespace**: On your GitHub repository page, click the green **Code** button, select the **Codespaces** tab, and click **Create codespace on main**.
3.  **Install & Run**: Once the editor opens in your browser:
    -   It might automatically run `npm install`. If not, type `npm install` in the terminal.
    -   Type `npm run dev` to start the app.
    -   A popup will appear saying "Your application is running on port 3000." Click **Open in Browser**.

## 🔑 Setting up the AI (Gemini API Key)

The "AI Forge" features require a Google Gemini API Key.

1.  Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  **The Pro Way (GitHub Secrets)**:
    -   Go to your GitHub Repo -> **Settings** -> **Secrets and variables** -> **Codespaces**.
    -   Click **New repository secret**.
    -   Name: `GEMINI_API_KEY`
    -   Value: (Paste your key here)
    -   Restart your Codespace.
3.  **The Quick Way (.env file)**:
    -   In the Codespace editor, create a new file named `.env`.
    -   Paste this line into it: `GEMINI_API_KEY=your_actual_key_here`

## 🛠️ Features
- **GitHub Asset Scraper**: Pull models and textures from Java mod repos.
- **Bedrock Generator**: Converts Java JSON models to Bedrock geometry.
- **AI Forge**: Use Gemini to generate block states and scripts.
- **3D Preview**: View models before exporting.
- **One-Click Export**: Downloads a ready-to-use `.mcaddon` file.
