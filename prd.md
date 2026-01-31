

## PRD: Modern "Hub" Portfolio for GitHub Pages

### 1. Project Overview

* **Goal:** Create a high-performance, minimalist, and responsive portfolio website that serves as a central "hub" for existing GitHub Pages projects.
* **Platform:** GitHub Pages (hosted at `yourusername.github.io`).
* **Primary Action:** Visitors should be able to browse a gallery of projects and click through to the live demo (existing GitHub Pages) or the source code.

### 2. Core Features & User Stories

| Feature | Requirement |
| --- | --- |
| **Project Gallery** | A grid-based layout displaying cards for each existing GitHub Pages project. |
| **Live Previews** | Cards must link to `username.github.io/project-name/`. |
| **Auto-Sync** | (Optional/Advanced) Use the GitHub API to fetch public repositories tagged with a specific topic (e.g., `portfolio-item`). |
| **Responsive Design** | Mobile-first layout using modern CSS (Grid/Flexbox). |
| **Dark/Light Mode** | A toggle for user preference. |

### 3. Technical Stack

* **Framework:** **Astro** (Recommended for speed and SEO) or **Vite + React/Vue**.
* **Styling:** **Tailwind CSS** for rapid, modern UI development.
* **Deployment:** GitHub Actions to build and deploy to the `gh-pages` branch.

### 4. Site Structure

1. **Hero Section:** Catchy headline, brief bio, and social links (GitHub, LinkedIn).
2. **Projects Section:** * **Card UI:** Title, Thumbnail (screenshot), Tech Stack tags, "Live Demo" button, "View Code" button.
3. **About/Skills:** A clean list of technologies and a short professional summary.
4. **Contact:** Minimalist footer with an email link.

### 5. Instructions for Antigravity Agent

> **Agent Mission:**
> 1. Initialize a new **Astro + Tailwind** project in the current directory.
> 2. Create a `projects.json` file to store metadata for my existing GitHub Pages (URL, name, description).
> 3. Build a `ProjectCard` component that takes this metadata and renders a modern UI card.
> 4. Ensure the main page is a single-page scrolling layout.
> 5. Configure a **GitHub Action** (`.github/workflows/deploy.yml`) so that every push to `main` automatically updates the site on GitHub Pages.
> 6. **Self-Correction:** Check for accessibility (Aria labels) and ensure images are optimized (WebP).
> 
> 

