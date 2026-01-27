# Import Organization

## Import Order

Follow this exact order for all imports:

1. **External dependencies** (React, libraries)
2. **Internal absolute imports** (@/components, @/hooks)
3. **Relative imports** (./Component, ../utils)
4. **Type imports** (type imports)

## Example

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

## Using Hierarchical Exports

**Always use hierarchical index.ts exports** for clean imports:

```typescript
// ✅ Good - using hierarchical export
import { Button, Header, TVDashboard } from '@/components';

// ❌ Bad - direct path import
import { Button } from '@/components/common/Button';
```

This applies to:
- `@/components`
- `@/hooks`
- `@/utils`
- `@/types`
- `@/services`
- `@/stores`
- `@/constants`

## Type Imports

Use `type` keyword for type-only imports:

```typescript
import type { User } from '@/types';
import type { ButtonProps } from 'primereact/button';
```

This helps with tree-shaking and makes it clear these are type-only imports.
