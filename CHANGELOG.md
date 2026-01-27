# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with custom increment rules.

## Versioning Rules

- **Patch (0.0.1)**: Small changes, bug fixes, minor updates
- **Minor (0.1.0)**: Medium changes, new features, significant updates
- **Major (1.0.0)**: Major releases, production-ready milestones, breaking changes
- Version increments max at 9 (e.g., 0.9.9 → 1.0.0)

## [0.1.3] - 2026-01-27

### Changed

- Updated README.md to reflect current project state
- Added dark mode default theme information
- Added current version and status section
- Enhanced theme system documentation

## [0.1.2] - 2026-01-27

### Changed

- Set dark mode as default theme
- Fixed theme application to properly load from public/themes folder
- Ensured PrimeReact provider is properly configured with theme system

## [0.1.1] - 2026-01-27

### Changed

- Enhanced coding style documentation with comprehensive examples
- Added detailed parent component pattern example with HeroProps
- Added constants organization guidelines (separate files like MOTTO.ts)
- Added PrimeReact type extension guidelines (ButtonProps, etc.)
- Added type organization structure matching components structure
- Added import organization documentation
- Updated ESLint configuration to enforce TypeScript rules (no `any`/`unknown`)
- Enhanced pet peeves documentation with performance considerations
- Updated do's and don'ts with PrimeReact type extensions and type organization

### Technical Details

- ESLint now enforces: no `any`/`unknown` types, proper TypeScript usage, React hooks rules
- Added typescript-eslint packages for enhanced linting
- Documentation now includes hierarchical index.ts export patterns
- Added import-organization.md guide

## [0.1.0] - 2026-01-27

### Added

- Initial project setup with Next.js 16.1.6 and React 19.2.3
- Complete folder structure following KISS principles
- TypeScript configuration with strict type checking
- PrimeReact, PrimeFlex, and PrimeIcons integration
- Theme system with dynamic light/dark theme loading (copied from cpt-support-portal)
- Provider setup (PrimeReactProvider, ThemeProvider, Providers wrapper)
- Root layout with minimal structure and Providers integration
- Type definitions for dashboard, API responses, data sources, and widgets
- TV dashboard route structure (static and dynamic routes)
- TVDashboard component foundation (empty placeholder, ready for JSON-driven widgets)
- API service structure with flexible data source factory
  - Support for API, cron jobs, static data, and Jira integration
  - JSON-first, data-driven architecture
- Zustand store for dashboard state management
- Utility functions (formatters using date-fns, constants)
- Hierarchical index.ts exports for clean imports
- Documentation folder with:
  - Coding style guidelines
  - Pet peeves and code smells
  - Do's and Don'ts reference
  - Data architecture documentation
- Public folder with themes, backgrounds, logos, and icons
- Clean slate: removed all default Next.js/Vercel styling and content
- Version control and changelog system
- Versioning documentation and guidelines
- .cursor folder for Cursor-specific files (git-ignored)

### Technical Details

- **Framework**: Next.js 16.1.6 with App Router
- **React**: 19.2.3
- **TypeScript**: Latest (strict mode, no `any` or `unknown`)
- **State Management**: Zustand 5.0.10
- **UI Library**: PrimeReact 10.9.7, PrimeFlex 4.0.0, PrimeIcons 7.0.0
- **Form Handling**: react-hook-form 7.71.1
- **Date Utilities**: date-fns 4.1.0
- **Project Structure**: src/ folder with organized components, hooks, services, stores, types, utils, constants, config, providers

### Notes

- All components are empty placeholders - no UI implemented yet
- Foundation is ready for JSON-driven widget system
- Theme system follows cpt-support-portal pattern
- All code follows KISS principles and coding style guidelines
