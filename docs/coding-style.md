# Coding Style Guidelines

## Core Principle: KISS (Keep It Stupid Simple)

The main principle guiding all code decisions is simplicity in organization, coding, naming, and design.

## Component Structure

### Parent Component Pattern

Parent components (page-level routes) should follow this exact structure:

```typescript
// Example: About.tsx route component
const heroProps = {
  title: "Meet our Team",
  description: "Welcome to clean code!"
};

export const About = () => {
  // Parent level state only
  const [teamData, setTeamData] = useState<TeamDataInterface>([]);
  
  // Parent hooks only
  const { loadTeamData } = useAPICalls();
  
  // On page load functions in useEffect
  useEffect(() => {
    loadTeamData();
  }, []); // Empty dep array for page load single trigger example
  
  return (
    <div className="pageStyle">
      <HeroSection {...heroProps} />
      <CompanyMotto />
      <TeamTable data={teamData} />
    </div>
  );
};
```

### Key Points:

- **Minimal State**: Only use state at parent level when needed
- **No Prop Drilling**: Don't pass state down unnecessarily - it's rarely needed
- **Reusable Components**: Each component is self-contained and works with proper props
- **Clean Separation**: Components don't care about their parent or location
- **Small TSX**: The actual component JSX should be tiny - each functional component should be small

### Component Example Pattern

Notice how:
- Parent component is minimal and clean
- Each child component (`HeroSection`, `CompanyMotto`, `TeamTable`) is its own reusable functional component
- Components work exactly as intended as long as they're given the right props
- Some components don't need props at all (like `CompanyMotto` which loads from static text)

## File Organization

### Constants Organization

Static text and constants should be in **separate files**, not in one giant file:

```
constants/
  MOTTO.ts          # const MOTTO = "text here"
  COMPANY_INFO.ts  # const COMPANY_INFO = {...}
  TEAM_DATA.ts     # const TEAM_DATA = [...]
```

**Why?** As the app grows, having 500+ constants in one file becomes unmanageable. Separate files keep things organized and easy to find. Each constant gets its own file.

**Example**:
```typescript
// constants/MOTTO.ts
export const MOTTO = "Welcome to clean code! This is our company motto.";
```

Then in the component:
```typescript
// CompanyMotto.tsx
import { MOTTO } from '@/constants/MOTTO';

export const CompanyMotto = () => {
  return <div>{MOTTO}</div>;
};
```

**Note**: Don't use raw HTML in components. Keep TSX clean and import constants from separate files.

### File Size Limits

- **Maximum 300 lines per file** (exceptions for CSS files, but TSX should be precise)
- If a function requires scrolling 100s of lines, it should be refactored
- Components should be small and focused
- Extract logic to hooks or services when needed
- **Every function should be visible on a regular-sized screen** - if you have to scroll 100s of lines in a function, it's no good and should be reworked smarter

**Exceptions**: CSS files may be longer, but TSX should be precise. There are some exceptions that can't be avoided, but main page route parent components, reusable components, types, and constants should be organized properly.

**Note**: This doesn't mean go overboard and separate everything. If things are clearly linked together, best practice is to keep them together and name the file so it makes sense.

## Naming Conventions

Follow React and Next.js best practices:

- **Components**: PascalCase (`Button.tsx`, `UserProfile.tsx`)
- **Component Names**: PascalCase (`export const Button = () => {}`)
- **Constants**: UPPER_SNAKE_CASE for true constants (`MY_LIST`, `MAX_RETRIES`, `MOTTO`)
- **Constant Objects**: camelCase (`export const apiEndpoints = {}`)
- **Hooks**: camelCase with `use` prefix (`useAuth.ts`, `useLocalStorage.ts`)
- **Files**: Match export names
- **Functions**: camelCase (`handleClick`, `formatDate`)
- **Services**: camelCase with descriptive suffix (`authService.ts`, `apiClient.ts`)
- **Types**: camelCase with descriptive name (`User.ts`, `ApiResponse.ts`) or `.types.ts` suffix

**Stay specific to best practices shared between React and Next.js** - don't mix naming conventions.

## React Patterns

### Functional Components Only

- Use functional components with arrow functions
- **No class components** - they're basically deprecated and never used anymore for UI
- We have functional and higher-order components that use arrow functions
- No longer need to use classes with their big overhead of extra code
- Use hooks for state and lifecycle
- Higher-order components when needed

### TypeScript Usage

- **NEVER use `any` or `unknown` types** - use proper types
- Use generics for reusable types
- **Extend interfaces when appropriate** - for example, PrimeReact components all have types we can import like `ButtonProps` which we can use to extend when we have wrappers or functional components that are or use buttons
- This is the same for all PrimeReact components - every single one has a prop interface or type that can be imported and extended
- Keep types specific and required
- Full TypeScript usage - leverage all features
- Use type guards for runtime checks

### Type Organization

Organize types in their own respective files in their own library, similar to how we have `/components`:

```
types/
├── common/
│   ├── DashboardModel.ts
│   ├── UserModel.ts
│   └── WidgetModel.ts
├── api/
│   ├── ApiResponse.ts
│   └── ApiRequest.ts
└── index.ts  # Export all from types
```

- Put related types in the same file if they should be together
- Or put them in another file specifically named
- Export them all from `types/index.ts` using hierarchical exports
- Keep types close to usage when feature-specific
- Use shared types folder for common types

## State Management

Mixed approach based on needs:

- **Component State**: `useState` for component-specific state or changing with callbacks from context
- **Context**: User info once logged in, basic session info, app-wide state
- **Zustand Stores**: Business logic, feature-specific state, specific tools
- **Adapt as needed** - use the best tool for the job for state
- Some things might be in both context and stores - adapt as needed

## Performance

### Critical Considerations:

- **This is very important** - we often have issues because devs or agents won't pay attention to React and how things render and when
- **Never cause unnecessary re-renders**
- Proper memoization with `useMemo`, `useCallback`, `memo`
- Cache expensive API calls
- Avoid calling APIs on every render
- **This application will be handling extremely large datasets and multiple users using this on different machines**
- We really need to make sure our data and data flow is super smooth
- More than that, also our UI look and feel must be smooth
- Smooth state flow and updates
- Handle large datasets efficiently

### Bad Smells:

- API calls on every render without caching (expensive API calls or constant server calls cause performance and high costs)
- Components re-rendering unnecessarily
- Large data sets causing performance issues

## Code Duplication

### Extract Repeated Code

- **Don't duplicate code** - extract to shared utilities, components, hooks, API calls, or their respective category
- **Example**: If you're using the same HTML code to make a card with specific content or layout, make a functional component so you can just reuse it and pass props for the stuff that needs to change
- This way you're not remaking code constantly
- Makes it easier to change and debug in future
- When you come across something you have to duplicate a lot, usually make a hook or component to replace it
- Sometimes you might need to add arguments to take to slightly customize the different scenarios, but it will save a lot of time and helps us organize

## Code Review Standards

- **Vital things should not be updated** unless necessary
- Pull requests should be specific to the feature - if doing a new feature, the code pull request should only have updates specific to that feature
- Get latest code before starting new features
- Start from ground up: foundation → business logic → UI
- Extract duplicated code into hooks/components

## Feature Development Workflow

When approaching a new feature:

1. **Get the latest** code
2. **Start from the ground up**:
   - Get the foundation such as parent components set up
   - Get the business logic ironed out and tested
   - Once that's all working, go and start the UI
3. **Extract duplicates**: Each time you come across something you have to duplicate a lot, usually make a hook or component to replace it
4. **Customize with props**: Sometimes you might need to add arguments to take to slightly customize the different scenarios, but it will save a lot of time and helps us organize

## Refactoring Style

**"Rip it out" ideology:**

1. Look at things we don't need
2. Start ripping them out
3. Test to make sure everything still works
4. Organize and clean up where the remaining code should be
5. Do the refactor when they are cleaned up and in their new locations

## Import Organization

### Import Order

1. External dependencies (React, libraries)
2. Internal absolute imports (@/components, @/hooks)
3. Relative imports (./Component, ../utils)
4. Types (type imports)

### Example

```typescript
// External
import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import type { ButtonProps } from 'primereact/button';

// Internal absolute
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';

// Relative
import { formatDate } from './utils/formatters';
import type { User } from './types';
```

## Hierarchical Index.ts Exports

**Important**: In libraries like `components`, instead of exporting from its children folders and components directly, use a **hierarchical index.ts** that exports all from the children below it.

**This way** when we import anything from components, we can only use `@/components` for the import instead of things like `@/components/input/button`.

**This is considered our standard for all main libraries** like:
- `@/components`
- `@/hooks`
- `@/utils`
- `@/types`
- `@/services`
- `@/stores`
- `@/constants`

**Example**:
```typescript
// components/index.ts
export * from './common';
export * from './layout';
export * from './ui';
export * from './pages';

// Then import like:
import { Button, Header, TVDashboard } from '@/components';
// Instead of:
import { Button } from '@/components/common/Button';
```

## Component Structure Template

```typescript
// Component.tsx
import React from 'react';
import type { ComponentProps } from '@/types';

// Extend PrimeReact types when wrapping components
import type { ButtonProps } from 'primereact/button';

interface CustomButtonProps extends ButtonProps {
  customProp?: string;
}

/**
 * Component description
 * 
 * @param props - Component props
 */
export const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState();
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, []);
  
  // Handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

## Linter Enforcement

- Make sure to enforce our rules with linter
- ESLint should catch:
  - Use of `any` or `unknown` types
  - Files exceeding reasonable line counts
  - Missing type definitions
  - Performance anti-patterns

## Testing

- Haven't traditionally tested in the past
- Would be cool to make a transition into having unit tests and potentially test-driven development
- This is an area for future improvement

## Tech Stack

- React latest stable version
- Next.js latest stable version
- TypeScript latest
- PrimeReact
- PrimeFlex
- PrimeIcons
- date-fns
- react-hook-form
- zustand (case by case basis)
