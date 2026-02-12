# Do's and Don'ts

## ✅ DO

### Component Structure

- **DO** keep components small and focused (under 300 lines)
- **DO** use functional components with arrow functions
- **DO** extract repeated code into hooks or components
- **DO** keep parent components minimal with only necessary state
- **DO** make components reusable and self-contained
- **DO** use proper TypeScript types (no `any` or `unknown`)
- **DO** separate concerns (components, hooks, services, types)

### File Organization

- **DO** keep files under 300 lines
- **DO** organize constants in separate files
- **DO** use hierarchical index.ts exports for clean imports
- **DO** co-locate related files (component + styles + tests)
- **DO** use descriptive file and folder names
- **DO** group by domain/concern when appropriate

### Performance

- **DO** use `useMemo`, `useCallback`, and `memo` appropriately
- **DO** cache expensive API calls
- **DO** use `useEffect` with proper dependency arrays
- **DO** avoid unnecessary re-renders
- **DO** optimize for large datasets
- **DO** implement proper caching strategies

### State Management

- **DO** use `useState` for component-specific state
- **DO** use Context for app-wide state (user, session)
- **DO** use Zustand for business logic and feature state
- **DO** choose the right tool for each use case
- **DO** keep state minimal and focused

### TypeScript

- **DO** use proper types and interfaces
- **DO** use generics for reusable types
- **DO** extend interfaces when appropriate (especially PrimeReact component props like ButtonProps)
- **DO** leverage TypeScript's full feature set
- **DO** keep types specific and required
- **DO** organize types in /types folder similar to /components structure
- **DO** use hierarchical index.ts exports for types

### Code Review

- **DO** keep pull requests focused on specific features
- **DO** get latest code before starting new features
- **DO** start from foundation → business logic → UI
- **DO** extract duplicates into reusable code
- **DO** test after refactoring

## ❌ DON'T

### Component Structure

- **DON'T** create giant files (>300 lines)
- **DON'T** use class components for UI
- **DON'T** prop drill unnecessarily
- **DON'T** mix concerns in components
- **DON'T** create components that depend on parent context
- **DON'T** use `any` or `unknown` types
- **DON'T** duplicate code across components

### File Organization

- **DON'T** put all constants in one giant file
- **DON'T** create deep nesting (max 3-4 levels)
- **DON'T** over-organize (don't create folders for 1-2 files)
- **DON'T** mix naming conventions
- **DON'T** create files without clear purpose

### Performance

- **DON'T** call APIs on every render
- **DON'T** skip caching for expensive operations
- **DON'T** cause unnecessary re-renders
- **DON'T** ignore performance with large datasets
- **DON'T** use inline functions in JSX without memoization

### State Management

- **DON'T** use global state for component-specific state
- **DON'T** prop drill through many levels
- **DON'T** mix state management patterns unnecessarily
- **DON'T** store everything in one giant store

### TypeScript

- **DON'T** use `any` or `unknown` without proper handling
- **DON'T** skip type definitions
- **DON'T** use loose types when specific types are available

### Code Review

- **DON'T** update vital things unless necessary
- **DON'T** mix multiple features in one PR
- **DON'T** skip testing after changes
- **DON'T** ignore code smells

### Console & runtime

- **DO** check the browser console after changes; there should be no errors or warnings
- **DON'T** leave `console.log` / `console.debug` / `console.info` in code (ESLint warns; use `console.warn` or `console.error` only if needed)

### UI Development

- **DON'T** prebake UI without requirements
- **DON'T** add styling before structure is defined
- **DON'T** create components before understanding needs

## Best Practices Summary

### When Starting a New Feature

1. Get latest code
2. Start from foundation (parent components)
3. Iron out business logic and test
4. Build UI after logic works
5. Extract duplicates into reusable code

### When Refactoring

1. Identify what's not needed
2. Remove and test
3. Organize remaining code
4. Clean up and refactor

### When Writing Components

1. Keep it small (<300 lines)
2. Make it reusable
3. Use proper TypeScript
4. Consider performance
5. Follow naming conventions

### When Organizing Code

1. Group by concern/domain
2. Use hierarchical exports
3. Keep files focused
4. Separate constants when needed
5. Co-locate related files

## Quick Reference

**Always**:
- Keep it simple (KISS)
- Use proper types
- Cache expensive operations
- Extract duplicates
- Test after changes
- Check the browser console for errors when making UI or API changes

**Never**:
- Use `any` types
- Create giant files
- Call APIs on every render
- Skip performance considerations
- Mix concerns
- Ship with console errors or stray `console.log`