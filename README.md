# 🧩 AutaKimi Extensions & Plugins

This repository is the centralized ecosystem for dynamic logic and content discovery in **AutaKimi**. It allows the application to remain a neutral framework while providing powerful community-driven features.

## 📂 Repository Structure

| File | Purpose |
| :--- | :--- |
| `templates.json` | Master engines for various website themes (Madara, MangaStream, etc). |
| `plugins.json` | Sandboxed JavaScript modules for specialized tasks (e.g., Cloudflare solving). |
| `manga_sources.json` | Curated list of manga providers and their associated templates. |
| `anime_sources.json` | Curated list of anime providers. |
| `manga_catalogs.json` | Index of all available language-specific Manga catalogs. |
| `anime_catalogs.json` | Index of all available language-specific Anime catalogs. |
| `MangaCatalogs/` | JSON files containing community-maintained metadata for manga sources. |
| `AnimeCatalogs/` | JSON files containing community-maintained metadata for anime sources. |
| `icons/` | High-quality icons for various extensions and sources. |

---

## ⚡ Plugin System
Plugins are sandboxed JavaScript modules that run in the AutaKimi Main Process within a `vm.createContext` sandbox.

### Plugin Manifest Schema
```json
{
  "id": "unique-plugin-id",
  "name": "Display Name",
  "description": "What it does",
  "author": "Author Name",
  "version": "1.0.0",
  "target": "main-cloudflare",
  "code": "return (context) => { ... }"
}
```

### Supported Targets
- `main-cloudflare`: Runs automatically when a browser challenge window is opened. Receives `{ win }` (BrowserWindow proxy) in the context.

### Lifecycle & Disposers
Plugins must return an asynchronous function (the executor). This executor can optionally return a **Disposer** (cleanup function).
```javascript
return async (context) => {
  const interval = setInterval(() => { ... }, 1000);
  // Cleanup on success or window close
  return () => clearInterval(interval);
}
```

---

## 📡 Content Sources
Sources define specific websites and link them to a scraping engine (template).
```json
{
  "id": "asurascans",
  "name": "Asura Scans",
  "url": "https://asura.nacm.me",
  "templateId": "mangastream",
  "icon": "autakimi-cache://local-icon/asurascans.png"
}
```

---

## 🛠️ Contributing

We've introduced a **TypeScript Build Pipeline** to make extending AutaKimi much easier! You no longer need to write escaped JavaScript logic directly inside JSON strings. Instead, you can author clean, fully syntax-highlighted, and auto-completed TypeScript.

### Workflow & Directory Structure

1. **Templates**:
   - Write/edit templates inside the [`src/templates/`](file:///D:/DEV/Apps/AutaKimi/autakimi-extensions/src/templates) folder (e.g., `src/templates/madara.ts`).
   - The file should export a default function returning the code string:
     ```typescript
     export default function(baseUrl: string, ua: string) {
       return `const baseUrl = ${JSON.stringify(baseUrl)}; ...`;
     }
     ```
2. **Plugins**:
   - Write/edit sandboxed Electron plugins inside the [`src/plugins/`](file:///D:/DEV/Apps/AutaKimi/autakimi-extensions/src/plugins) folder (e.g., `src/plugins/auto-solve-cf.ts`).
   - The file should export a default async executor function.

3. **Native Extensions (Isolated Custom Logic)**:
   - For sources that require completely custom parsing logic that doesn't fit into a template, write them as TypeScript classes in [`src/native/`](file:///D:/DEV/Apps/AutaKimi/autakimi-extensions/src/native).
   - Ensure your class implements `ISourceAdapter` and extends sandbox-compatible bases (like `MadaraSource` from `src/base/`).
   - The build pipeline will bundle these into standalone, isolated JavaScript payloads in the `js/` directory to run safely inside the App's Sandbox VM.

### Local Development & Building

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Update Metadata**:
   - If adding a new source, update `manga_sources.json` or the relevant catalog (e.g., `MangaCatalogs/Arabic.json`). Make sure to use `"templateId": "native"` if it's a native extension.
3. **Build the Extensions**:
   - On Windows, simply double-click the `build.bat` file, OR run:
   ```bash
   npx tsx build.ts
   ```
   - This compiles your TS files statically, bundles native extensions into the `js/` directory, and updates `templates.json` and `plugins.json` automatically.
4. **Test in AutaKimi**:
   - Launch the AutaKimi Desktop App in development mode (`npm run dev:desktop`).
   - The app's `localFileInterceptor` will automatically intercept fetches to the remote GitHub repository and serve your newly built local files (including the `js/*.js` bundles) directly from your disk!

### Automated Distribution (GitHub Actions)

You **do not need to commit the generated JSON files manually**! 
1. Just commit your `src/` TS files and submit a **Pull Request**.
2. Our **GitHub Actions CI** will validate your PR by building the files.
3. Upon merging into the main branch, the GitHub Action automatically re-compiles the files and commits `templates.json` and `plugins.json` back to the repository.

### Additional Guidelines

- **Icons**: Place icons in the `icons/` folder named as `{package_id}.png`.

## 🛡️ Legal Notice & Neutrality
**AutaKimi** is a neutral media viewer framework. This repository is community-maintained and is intentionally decoupled from the core application source code. It does not host, provide, or link to any copyrighted media content.

---
<p align="center">
  Part of the <a href="https://github.com/Autakimi-Ecosystem">AutaKimi Ecosystem</a>
</p>
