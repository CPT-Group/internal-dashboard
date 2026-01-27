# Coding Style Guide - Quick Reference Summary

This is a quick reference summary of our coding style. For detailed information, see the full documentation files.

## Core Principle

**KISS - Keep It Stupid Simple**

Simplicity in organization, coding, naming, and design.

## Key Rules

### File Size
- **Maximum 300 lines** per file (TSX should be precise)
- Every function should be visible on a regular-sized screen
- If you scroll 100s of lines in a function, refactor it

### Component Structure
- Parent components: minimal state, hooks, useEffect for page load
- Small, reusable functional components
- No prop drilling unless necessary
- Components don't care about parent or location

### Constants
- **Separate files** for each constant (e.g., `MOTTO.ts`, `COMPANY_INFO.ts`)
- Don't put 500+ constants in one file
- Keep TSX clean - import constants, don't use raw HTML

### Naming
- Components: **PascalCase** (`Button.tsx`)
- Constants: **UPPER_SNAKE_CASE** (`MY_LIST`, `MOTTO`)
- Hooks: **camelCase** with `use` prefix (`useAuth.ts`)
- Files: Match export names

### TypeScript
- **NEVER** use `any` or `unknown`
- Use generics, extend interfaces
- **Extend PrimeReact types** (ButtonProps, etc.) when wrapping components
- Organize types in `/types` similar to `/components` structure

### Imports
- Use **hierarchical index.ts exports**
- Import from `@/components`, not `@/components/common/Button`
- Follow import order: External → Internal absolute → Relative → Types

### Performance
- **Critical**: Never cause unnecessary re-renders
- Cache expensive API calls
- Handle large datasets efficiently
- Multiple users on different machines - data flow must be smooth

### Code Duplication
- Extract repeated code into components, hooks, or utilities
- If you duplicate HTML for cards/layouts, make a component
- Add props to customize different scenarios

### State Management
- `useState`: Component-specific state
- Context: User info, session info, app-wide
- Zustand: Business logic, feature-specific

## Workflow

### New Feature
1. Get latest code
2. Foundation → Business logic → UI
3. Extract duplicates as you go

### Refactoring
1. Identify what's not needed
2. Rip it out
3. Test everything still works
4. Organize remaining code
5. Refactor when in proper locations

## Documentation Files

- `coding-style.md` - Full detailed guidelines
- `pet-peeves.md` - Code smells to avoid
- `do-donts.md` - Best practices reference
- `import-organization.md` - Import patterns
- `versioning.md` - Version control rules
- `data-architecture.md` - Data-driven approach

## Quick Checks

Before committing, ask:
- ✅ Is this file < 300 lines?
- ✅ Are constants in separate files?
- ✅ Am I using hierarchical exports?
- ✅ No `any` or `unknown` types?
- ✅ Am I extending PrimeReact types when needed?
- ✅ Is this causing unnecessary re-renders?
- ✅ Can this duplicated code be extracted?
- ✅ Is this easy to find and understand?
