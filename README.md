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
1. **Fork** this repository.
2. **Add/Update** templates, plugins, or sources.
3. Ensure all JavaScript logic is properly stringified for JSON compatibility.
4. **Icons**: Place icons in the `icons/` folder named as `{package_id}.png`.
5. **Submit a Pull Request**.

## 🛡️ Legal Notice & Neutrality
**AutaKimi** is a neutral media viewer framework. This repository is community-maintained and is intentionally decoupled from the core application source code. It does not host, provide, or link to any copyrighted media content.

---
<p align="center">
  Part of the <a href="https://github.com/Autakimi-Ecosystem">AutaKimi Ecosystem</a>
</p>
