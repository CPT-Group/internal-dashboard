# Internal Dashboard

Internal TV dashboard application for displaying company stats, heat maps, and other dashboard widgets on office TVs.

## Overview

This is a Next.js-based dashboard application designed to run on internal TVs throughout the office. Each TV can be configured to display different dashboard content via routes like `/tv/conference-room`, `/tv/dev`, etc.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **React**: 19.2.3
- **TypeScript**: Latest (strict mode)
- **UI Library**: PrimeReact 10.9.7, PrimeFlex 4.0.0, PrimeIcons 7.0.0
- **State Management**: Zustand 5.0.10
- **Form Handling**: react-hook-form 7.71.1
- **Date Utilities**: date-fns 4.1.0

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with Providers
│   ├── page.tsx            # Home page
│   ├── main.scss           # Global style entry (variables → base → utilities → themes)
│   └── tv/                 # TV dashboard routes
│       ├── page.tsx        # TV route index/landing
│       ├── [roomName]/     # Dynamic room routes
│       └── conference-room/ # Static route example
│
├── components/             # Shared/reusable components
│   ├── common/            # Generic components
│   ├── layout/            # Layout components
│   ├── ui/                # UI-specific components
│   └── pages/             # Page-level components
│       └── TVDashboard/   # TV dashboard component
│
├── hooks/                 # Custom hooks
├── services/              # Business logic & API
│   ├── api/              # API clients
│   └── data/             # Data services (API, cron, static)
├── stores/                # Zustand stores
├── types/                 # TypeScript definitions
├── utils/                 # Utility functions
├── constants/             # Application constants
├── config/                # Configuration
├── styles/                # Global SCSS (variables, base, utilities, themes)
└── providers/             # React context providers
```

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm, yarn, pnpm, or bun

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Features

### Data-Driven Architecture

The application uses a **JSON-first, data-driven architecture** that supports multiple data sources:

- **API**: Real-time data from REST endpoints
- **Cron Jobs**: Data pulled periodically (Jira, external APIs)
- **Static**: Configuration and rarely-changing data

All data sources return consistent JSON structures, making components source-agnostic.

### Theme System

SCSS-based theme system (aligned with cpt-internal-tools):
- **Default theme**: **dark-synth** (synthwave purple/cyan). Also available: dark, light, ms-access-2010.
- Theme is applied via `data-theme` on `<html>`; one CSS bundle (no dynamic theme link).
- Theme preference stored in `localStorage` under `cpt-theme`. Invalid or missing value falls back to dark-synth.
- **Theme switcher**: Home page only (sticky button at top cycles themes). Other routes have no switcher.
- **Full details**: See **`docs/theme-system.md`** for usage, file structure, and how to add or update themes.

### TV Routes

- Static routes: `/tv/conference-room`, `/tv/dev`, etc.
- Dynamic routes: `/tv/[roomName]` for flexible room names
- Each route can display different dashboard configurations

## Development Guidelines

### Coding Style

See `docs/coding-style.md` for comprehensive coding guidelines. Key principles:

- **KISS**: Keep It Stupid Simple
- **Small Components**: Maximum 300 lines per file
- **Type Safety**: Full TypeScript, no `any` or `unknown`
- **Performance**: Proper memoization, caching, avoid unnecessary re-renders
- **Separation of Concerns**: Components, hooks, services, types all separated

### Code Smells

See `docs/pet-peeves.md` for common code smells to avoid:

- Files > 300 lines
- Excessive HTML without components
- Repeated code not modularized
- API calls on every render without caching
- Hard to pinpoint root causes

### Best Practices

See `docs/do-donts.md` for do's and don'ts reference.

### Data Architecture

See `docs/data-architecture.md` for details on the JSON-driven data approach.

## Versioning

This project follows semantic versioning with custom increment rules:

- **Patch (0.0.1)**: Small changes, bug fixes
- **Minor (0.1.0)**: Medium changes, new features
- **Major (1.0.0)**: Major releases, production-ready
- **Current Version**: 0.1.2

See `package.json` for current version and `CHANGELOG.md` for version history.

## Documentation

- **`docs/app-overview.md`** – **Start here.** What the app is for, who it’s for, routes, data, and current implementation (TV dashboards, Jira NOVA, conference room, etc.).
- `docs/dashboard-planning.md` - Route structure, home design, dev dashboard layout
- `docs/coding-style.md` - Comprehensive coding style guidelines with examples
- `docs/pet-peeves.md` - Code smells and anti-patterns
- `docs/do-donts.md` - Best practices reference
- `docs/data-architecture.md` - Data-driven JSON approach
- `docs/jira-ticket-schema.md` - Jira issue shape for NOVA
- `docs/versioning.md` - Version control and changelog guidelines
- `docs/import-organization.md` - Import order and hierarchical exports
- `docs/style-guide-summary.md` - Quick reference summary
- **`docs/theme-system.md`** – **Theme reference.** How the theme system works, how to use it, and how to add/update themes (for developers and agents).
- `docs/primereact-theming.md` - PrimeReact theming (legacy; see theme-system.md for current behavior)
- `CHANGELOG.md` - Version history and changes

## Current Status

- **Version**: See `package.json` (e.g. 0.1.x)
- **Theme**: dark-synth (default), dark, light, ms-access-2010; switch on home page only. See `docs/theme-system.md`.
- **Home**: Card-based TV dashboard selector; links to `/tv/{roomName}`
- **TV dashboards**: Dev Corner Two (NOVA Jira – stats, charts, table); Conference Room (custom background, placeholder content); dev-corner-one, lobby, break-room stubbed
- **Data**: Jira NOVA via API + Zustand store (5‑min cache); JSON-driven architecture for future sources

## License

Private - Internal use only
