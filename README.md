# 🧩 AutaKimi Extensions

This repository serves as the centralized source for dynamic scraping templates used by the **AutaKimi** platform. 

## 🛡️ Legal Notice & Neutrality
**AutaKimi** is a neutral media viewer framework. This repository is community-maintained and is intentionally decoupled from the core application source code. 

These templates are purely functional instructions (logic) that teach the AutaKimi SDK how to parse standard web structures (like Madara or MangaStream themes). This repository does not host, provide, or link to any copyrighted media content.

## 📂 Contents
- **`templates.json`**: The master configuration file containing stringified JavaScript generators for various website themes.

## 🛠️ How it Works
1. The AutaKimi apps fetch the `templates.json` from this repository on startup.
2. The **TemplateService** in the SDK dynamically registers these generators.
3. When a user adds a website, the app uses these templates to "detect" the theme and execute the corresponding scraping logic in a secure sandbox.

## ✍️ Contributing
We welcome community-driven improvements!
1. **Fork** this repository.
2. **Update** or add new template logic to `templates.json`.
3. Ensure your JavaScript code is properly stringified.
4. **Submit a Pull Request**.

---
<p align="center">
  Part of the <a href="https://github.com/Autakimi-Ecosystem">AutaKimi Ecosystem</a>
</p>
