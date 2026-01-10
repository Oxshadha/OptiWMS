# Frontend Structure Guide

This document explains the frontend architecture and structure of OptiWMS.

## Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + DaisyUI
- **Icons**: Material Symbols Outlined
- **State Management**: React Hooks (useState, useEffect)
- **Offline Storage**: IndexedDB (planned)

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── (admin)/           # Admin route group (shared layout)
│   │   ├── dashboard/
│   │   ├── warehouses/
│   │   └── layout.tsx     # Admin layout
│   ├── (worker)/          # Worker route group (shared layout)
│   │   ├── page.tsx       # Worker home
│   │   ├── tasks/
│   │   ├── picking/
│   │   └── layout.tsx     # Worker PWA layout
│   ├── admin/             # Admin routes (alternative structure)
│   │   ├── dashboard/
│   │   ├── orders/
│   │   └── layout.tsx
│   ├── worker/            # Worker routes (alternative structure)
│   │   ├── page.tsx
│   │   └── tasks/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Root page
│   └── globals.css        # Global styles
├── components/            # Reusable React components
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   └── KpiTile.tsx
├── lib/                   # Utility functions
│   └── api.ts            # API client functions
├── public/               # Static assets
│   ├── assets/
│   │   └── avatars/
│   └── manifest.json
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Routing Structure

### Route Groups
Next.js uses `(group)` syntax for shared layouts without affecting URL structure.

#### Admin Routes
- **Group**: `(admin)` - Shared admin layout
- **Routes**:
  - `/admin/dashboard` → `app/(admin)/dashboard/page.tsx`
  - `/admin/warehouses` → `app/(admin)/warehouses/page.tsx`

#### Worker Routes
- **Group**: `(worker)` - Shared worker PWA layout
- **Routes**:
  - `/worker` → `app/(worker)/page.tsx`
  - `/worker/tasks` → `app/(worker)/tasks/page.tsx`
  - `/worker/tasks/[id]` → `app/(worker)/tasks/[id]/page.tsx` (dynamic)

### Route Naming Rules
1. **Use kebab-case**: `cycle-count`, `order-details`
2. **Be descriptive**: `warehouse-management` not `wh-mgmt`
3. **Consistent structure**: Follow existing patterns
4. **Check before creating**: Search for similar routes first

## Component Structure

### Page Components
Located in `app/**/page.tsx`

**Structure:**
```typescript
"use client"; // If using hooks

export default function PageName() {
  // Component logic
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Reusable Components
Located in `components/`

**Naming**: PascalCase (e.g., `UserProfile.tsx`, `OrderTable.tsx`)

**Structure:**
```typescript
"use client";

interface ComponentProps {
  // Props definition
}

export function ComponentName({ prop1, prop2 }: ComponentProps) {
  return (
    // JSX
  );
}
```

### Component Guidelines
- **One component per file**
- **Export as named export** (not default for components)
- **Use TypeScript interfaces** for props
- **Keep components focused** - Single responsibility

## Styling Guidelines

### Tailwind CSS
- **Use utility classes**: `className="flex items-center gap-4"`
- **Responsive**: `md:flex-row`, `lg:w-1/2`
- **Theme colors**: Use DaisyUI theme variables
  - `bg-primary`, `text-primary-content`
  - `bg-base-100`, `text-base-content`
  - `bg-neutral`, `text-neutral-content`

### DaisyUI Components
- **Buttons**: `<button className="btn btn-primary">`
- **Cards**: `<div className="card card-surface">`
- **Modals**: Use DaisyUI modal classes
- **Forms**: Use DaisyUI form components

### Material Symbols Icons
```typescript
<span className="material-symbols-outlined">icon_name</span>
```

**Icon Naming**: Use kebab-case (e.g., `shopping_cart`, `inventory_2`)

### Custom Styles
- **Global styles**: `app/globals.css`
- **Component-specific**: Use Tailwind classes
- **Avoid inline styles** unless necessary

## File Naming Conventions

### Pages
- **kebab-case**: `order-details/page.tsx`
- **Descriptive**: `warehouse-management/page.tsx`

### Components
- **PascalCase**: `UserProfile.tsx`, `OrderTable.tsx`
- **Descriptive**: `WarehouseCard.tsx` not `WHCard.tsx`

### Utilities
- **camelCase**: `fetchWarehouses.ts`, `formatDate.ts`
- **Descriptive**: `calculateTotal.ts` not `calc.ts`

## State Management

### Local State
Use React hooks for component-level state:
```typescript
const [count, setCount] = useState(0);
const [data, setData] = useState<DataType | null>(null);
```

### Server State
Use Next.js Server Components when possible:
```typescript
// Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### Offline State (Planned)
- Use IndexedDB for persistent storage
- Sync with backend when online
- See `docs/plan.md` for details

## API Integration

### API Client
Location: `frontend/lib/api.ts`

### Usage
```typescript
import { fetchWarehouses } from '@/lib/api';

// In component
const warehouses = await fetchWarehouses();
```

### Adding New API Functions
```typescript
// lib/api.ts
export async function fetchResource() {
  const res = await fetch(`${API_BASE}/api/resource`, {
    headers: {
      Authorization: "Basic " + btoa("admin:admin123"),
    },
  });
  if (!res.ok) throw new Error("Failed to load resource");
  return res.json();
}
```

## Layout Structure

### Root Layout
`app/layout.tsx` - Applies to all pages
- Sets up theme (`data-theme="optiwms"`)
- Includes global styles
- Provides root HTML structure

### Admin Layout
`app/(admin)/layout.tsx` - Admin dashboard layout
- Sidebar navigation
- Topbar with search, notifications
- Main content area

### Worker Layout
`app/(worker)/layout.tsx` - Worker PWA layout
- Mobile-optimized header
- Bottom navigation
- Status indicators
- Notification/Calendar modals

## Common Patterns

### Page Structure
```typescript
"use client";

export default function PageName() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Page Title</h1>
      {/* Content */}
    </div>
  );
}
```

### Data Fetching
```typescript
"use client";

import { useState, useEffect } from "react";
import { fetchData } from "@/lib/api";

export default function DataPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{/* Render data */}</div>;
}
```

### Navigation
```typescript
import Link from "next/link";

<Link href="/admin/dashboard">Dashboard</Link>
```

## Development Guidelines

### Before Creating New Files
1. **Check existing structure**: Search for similar components/pages
2. **Follow naming conventions**: Use established patterns
3. **Check routing**: Ensure route doesn't conflict
4. **Coordinate with team**: Announce in team chat

### Component Reuse
- **Check `components/` folder** before creating new components
- **Extend existing components** when possible
- **Create reusable components** for repeated patterns

### Code Organization
- **Keep components small** - Single responsibility
- **Extract utilities** - Put reusable logic in `lib/`
- **Group related files** - Use folders for organization

## Testing Routes Locally

### Development Server
```bash
cd frontend
npm run dev
```

### Access Routes
- Admin: `http://localhost:3000/admin/dashboard`
- Worker: `http://localhost:3000/worker`
- Root: `http://localhost:3000`

## Common Issues and Solutions

### Route Not Found
- Check file location matches route
- Verify `page.tsx` exists
- Check for typos in route name

### Layout Not Applied
- Verify layout file exists in route group
- Check layout exports default component
- Ensure route is in correct group folder

### Styling Issues
- Check Tailwind classes are correct
- Verify DaisyUI theme is applied
- Check `globals.css` for custom styles

## Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [DaisyUI Docs](https://daisyui.com/)
- [Material Symbols](https://fonts.google.com/icons)

---

**Last Updated**: [Date]
**Maintained By**: Frontend Team

