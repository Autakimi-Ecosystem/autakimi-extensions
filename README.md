# 🧩 AutaKimi Extensions & Plugins Ecosystem

[![Build & Distribute Extensions](https://github.com/Autakimi-Ecosystem/autakimi-extensions/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/Autakimi-Ecosystem/autakimi-extensions/actions/workflows/build.yml)
[![Ecosystem](https://img.shields.io/badge/Ecosystem-AutaKimi-purple.svg)](https://github.com/anasx07/AutaKimi)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Bundled with esbuild](https://img.shields.io/badge/Bundler-esbuild-orange.svg)](https://esbuild.github.io/)
[![Tested with Vitest](https://img.shields.io/badge/Tests-Vitest-green.svg)](https://vitest.dev/)
[![Code Style: Prettier](https://img.shields.io/badge/Code%20Style-Prettier-ff69b4.svg)](https://prettier.io)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

This repository is the official, community-driven catalog and build pipeline for **AutaKimi** extensions, scraping engines, and automation plugins. It allows the core [AutaKimi application](https://github.com/anasx07/AutaKimi) to maintain a lean, neutral "empty shell" architecture while delivering dynamic, fast, and multi-language content discovery.

---

## 📖 Quick Start: Adding Extensions to AutaKimi

To access these extensions in your AutaKimi app (Desktop or Mobile):

1. Open **AutaKimi** and navigate to **Settings** ➔ **Extensions / Repositories**.
2. Click **Add Repository** and paste the official repository URL:
   ```http
   https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/dist/manifest.json
   ```
3. Confirm to subscribe. AutaKimi will automatically discover, categorize, and hydrate:
   - 🎬 **Anime Catalogs** (Arabic, English, etc.)
   - 📖 **Manga & Comic Catalogs** across 20+ languages
   - ⚡ **Dynamic Scraping Engines & Templates** (Madara, MangaThemesia, etc.)
   - 🛡️ **Automation Plugins** (e.g., Cloudflare challenge solvers)
   - 🖼️ **Offline Cached High-Resolution Icons**

---

## 🏛️ Ecosystem Architecture

```
autakimi-extensions/
├── src/
│   ├── base/                     # Core base classes & runtime dispatcher
│   │   ├── AnimeSource.ts        # Abstract base class for anime scrapers & stream extractors
│   │   ├── MadaraSource.ts       # Base class for WordPress Madara-themed sources
│   │   ├── sandboxDispatcher.ts  # Standard IPC bridge between sandbox & extension methods
│   │   └── urlUtils.ts           # URL resolution and formatting helpers
│   ├── extensions/               # Native TypeScript extensions
│   │   ├── anime/                # Anime sources partitioned by language
│   │   │   └── ar/               # Arabic anime providers (Anime4up, WitAnime, RistoAnime, ShahiidAnime)
│   │   └── manga/                # Manga sources partitioned by language (ar, en, fr, es, etc.)
│   ├── plugins/                  # Sandboxed Electron plugins (e.g., auto-solve-cf)
│   ├── templates/                # Reusable regex/DOM scraping templates (madara, mangastream)
│   └── types/                    # Unified TypeScript type definitions
├── dist/                         # Auto-compiled distribution artifacts (published on main)
│   ├── js/                       # Standalone minified IIFE bundles built by esbuild
│   ├── icons/                    # Source icons for offline caching
│   ├── AnimeCatalogs/            # Language-specific anime catalog JSONs
│   ├── MangaCatalogs/            # Language-specific manga catalog JSONs
│   ├── manifest.json             # Root repository manifest
│   ├── templates.json            # Dynamic template registry
│   └── plugins.json              # Sandboxed helper plugins registry
├── tests/                        # Vitest automated integration tests
└── build.ts                      # Automated build orchestrator & esbuild compiler
```

---

## ⚡ Extension Types

### 1. 🎬 Native Anime Extensions

Native anime extensions extend `AnimeSource` and provide robust web scraping for episode listings and direct video stream extraction:

- **Direct Stream Extraction**: Extracts direct MP4/HLS streams from popular hosting providers (VOE, Uqload, VidMoly, StreamRuby, MixDrop) with automatic fallback.
- **Embedded Player Support**: Fallback to sandboxed webview embeds when direct streams require specialized decryption.
- **Built-in Sources**:
  - `ma.autakimi.extension.ar.ristoanime` (✅ Active / Fully Supported)
  - `ma.autakimi.extension.ar.witanime` (⏳ In Development)
  - `ma.autakimi.extension.ar.anime4up` (⏳ In Development)
  - `ma.autakimi.extension.ar.shahiidanime` (⏳ In Development)

### 2. 📖 Manga Extensions (Templates & Native)

- **Template-Based Sources**: For sites running standard software (WordPress Madara, MangaThemesia/MangaStream), AutaKimi dynamically generates lightweight scrapers at runtime from `templates.json`.
- **Native Sources**: Custom TypeScript classes for unique sites requiring bespoke HTML parsers (e.g., MangaDex, specialized aggregators).

### 3. 🛡️ Sandboxed Helper Plugins

Plugins are specialized JavaScript modules running inside an isolated VM within the AutaKimi main process:

- **`auto-solve-cf`**: Automatically detects Cloudflare Turnstile / challenge checkpoints and guides the solver window until clearance cookies are captured.

---

## 🛠️ Developer Guide: Creating a New Extension

We use a modern TypeScript build pipeline with `esbuild`, Vitest, and ESLint 9. You author clean, strongly-typed TypeScript without touching compiled JSON files.

### 1. Prerequisites

- **Node.js**: `v20` or `v22` (LTS recommended)
- **npm**: `v10+`

### 2. Setup

```bash
# Clone the repository
git clone https://github.com/Autakimi-Ecosystem/autakimi-extensions.git
cd autakimi-extensions

# Install dependencies
npm install
```

### 3. Adding an Anime Extension

Create a new folder inside `src/extensions/anime/<lang>/<extension-id>/`:

```
src/extensions/anime/ar/myanime/
├── index.ts     # Extension logic & config
└── icon.png     # Square PNG icon (min. 128x128)
```

In `index.ts`:

```typescript
import {
  AnimeSource,
  AnimeDetails,
  Episode,
  VideoServer,
  VideoStream
} from '../../../../base/AnimeSource'

export const config = {
  pkg: 'ma.autakimi.extension.ar.myanime',
  name: 'MyAnime',
  lang: 'ar',
  version: '1.0.0',
  baseUrl: 'https://myanime.example.com',
  baseClass: 'Native',
  type: 'anime',
  nsfw: false
}

export class MyAnimeSource extends AnimeSource {
  readonly baseUrl = config.baseUrl

  async getPopularAnime(page = 1) {
    // Implement popular anime fetching
  }

  async getLatestUpdates(page = 1) {
    // Implement latest updates fetching
  }

  async searchAnime(query: string, page = 1) {
    // Implement search
  }

  async getAnimeDetails(animeId: string): Promise<AnimeDetails> {
    // Implement anime details extraction
  }

  async getEpisodes(animeId: string): Promise<Episode[]> {
    // Implement episodes list extraction
  }

  async getVideoServers(episodeId: string): Promise<VideoServer[]> {
    // Extract video servers (Uqload, VOE, VidMoly, etc.)
  }

  async getVideoStreams(serverUrl: string): Promise<VideoStream[]> {
    // Resolve direct streaming URLs
  }
}
```

### 4. Adding a Manga Extension

For manga sources:

- Place your source under `src/extensions/manga/<lang>/<extension-id>/`.
- If the site uses a known template (e.g., `madara` or `mangastream`), set `baseClass: 'Template'` and `templateId: 'madara'`.
- If custom logic is required, set `baseClass: 'Native'` and extend `MadaraSource` or create a bespoke class.

### 5. Local Testing & Quality Checks

```bash
# Compile extensions, bundle JS, and regenerate catalogs
npm run build

# Run unit and integration tests
npm test

# Run code linter
npm run lint

# Auto-format code
npm run format
```

### 6. Testing Locally in AutaKimi Desktop

1. Run `npm run build` in this repository.
2. Launch AutaKimi Desktop in dev mode:
   ```bash
   cd /path/to/AutaKimi
   npm run dev:desktop
   ```
3. In AutaKimi, navigate to **Settings** ➔ **Extensions** and point the repository to your local `dist/` directory or use `autakimi-local://`.
4. When testing Native extensions (`.js` files), remember to **Uninstall** and **Re-install** the extension in the app to flush the local SQLite bytecode cache.

---

## 🤖 Continuous Integration & Distribution

This repository uses automated GitHub Actions:

- **On Pull Request**:
  - Validates TypeScript compilation and builds all bundles.
  - Ensures linting and unit tests pass cleanly.
- **On Push to `main`**:
  - Automatically compiles all extensions via `esbuild`.
  - Regenerates `manifest.json`, `dist/js/*.js`, and language-specific catalog indexes.
  - Deploys changes directly to the distribution branch.

---

## 🛡️ Legal Notice & Neutrality

**AutaKimi** is a neutral, open-source media viewer framework. This repository is community-maintained and strictly decoupled from the core application source code. This project does not host, store, stream, or distribute any media files or copyrighted material. All scraping logic is executed on the client side at the user's explicit request.

---

<p align="center">
  Maintained by the <b>AutaKimi Community</b> &bull; Part of the <a href="https://github.com/anasx07/AutaKimi">AutaKimi Ecosystem</a>
</p>
