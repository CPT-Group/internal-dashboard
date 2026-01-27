# Code Smells and Pet Peeves

## File Size Issues

### Giant Files (>300 lines)

**Problem**: Files with excessive lines of code are hard to work with and often cause issues.

**Indicators**:
- Having to scroll 100s of lines in a function
- Files approaching or exceeding 300 lines
- Hard to locate specific functionality

**Solution**: 
- Split into smaller, focused files
- Extract logic to hooks or services
- Keep components under 300 lines
- Organize related code together

**Exceptions**: CSS files may be longer, but TSX should be precise

## HTML Without Components

### Excessive HTML in Components

**Problem**: Large blocks of HTML without using functional components.

**Indicators**:
- Components with 100+ lines of JSX
- Repeated HTML patterns
- Hard to read and maintain

**Solution**:
- Extract repeated patterns into components
- Break down large JSX into smaller components
- Keep component JSX clean and readable

## Code Duplication

### Repeated Code Not Modularized

**Problem**: Same code repeated in multiple places.

**Indicators**:
- Copy-paste code across files
- Similar logic in multiple components
- Changes require updates in multiple places

**Solution**:
- Create reusable hooks for shared logic
- Extract common patterns into components
- Use utility functions for repeated operations
- Add props/arguments to customize different scenarios

## Performance Issues

### API Calls on Every Render

**Problem**: Expensive API calls or constant server calls causing performance issues and high costs.

**Indicators**:
- API calls in component body (not in useEffect)
- No caching mechanism
- Calls triggered on every render
- High server costs

**Solution**:
- Use `useEffect` with proper dependency arrays
- Implement caching strategies
- Use React Query or similar for data fetching
- Cache expensive operations
- Only fetch when data actually needs to be refreshed

## Hard to Pinpoint Root Causes

### Poor Organization and Naming

**Problem**: When issues arise, it's difficult to find the root cause.

**Indicators**:
- Giant files with bad naming conventions
- Poor folder organization
- Unclear component/file purposes
- Hard to locate specific functionality

**Solution**:
- Follow best practice folder structure
- Use descriptive, consistent naming
- Keep files small and focused
- Organize by feature or concern
- Clear separation of components, hooks, services, types

## TypeScript Anti-Patterns

### Using `any` or `unknown`

**Problem**: Defeats the purpose of TypeScript.

**Indicators**:
- `any` types in code
- `unknown` without proper type guards
- Missing type definitions

**Solution**:
- Always use proper types
- Use generics for reusable types
- Extend interfaces appropriately
- Leverage TypeScript's full feature set

## State Management Issues

### Unnecessary Prop Drilling

**Problem**: Passing state through many component layers unnecessarily.

**Indicators**:
- Props passed through 3+ component levels
- State only used in one child component
- Context would be more appropriate

**Solution**:
- Use Context for shared state
- Use Zustand for business logic state
- Keep component state local when possible
- Only pass props when actually needed

## Testing and Quality

### No Testing Strategy

**Problem**: No unit tests or test-driven development.

**Note**: This is an area for improvement. While not currently implemented, it's recognized as important for code quality.

## Summary

**Key Indicators of Bad Code**:
1. Files > 300 lines (or methods > 300 lines)
2. Excessive HTML without components
3. Repeated code not modularized
4. API calls on every render without caching (expensive API calls or constant server calls cause performance and high costs)
5. Hard to pinpoint root causes - when there are issues, things should be easy to find and pinpoint
6. Poor naming conventions
7. Unnecessary prop drilling
8. Using `any` or `unknown` types
9. Giant files with bad naming conventions and poor organization make it hard to locate what we need - this is why following best practice structure is important

**Always Ask**:
- Can this be smaller?
- Can this be reused?
- Is this causing performance issues?
- Is this easy to find and understand?
- If I have to scroll 100s of lines in a function, should this be refactored?
