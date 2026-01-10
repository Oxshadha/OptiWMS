# 🎯 Frontend Best Practices & Industry Standards

## ✅ Issues Fixed

### 1. **React Hooks Order Violations**
**Problem**: Hooks declared after early returns cause "Rendered more hooks than during the previous render" error.

**Solution**: All hooks must be declared at the top of the component, before any conditional returns.

**Example (❌ Wrong):**
```typescript
export default function MyPage() {
  const [data, setData] = useState([]);
  
  if (loading) return <Loading />; // Early return
  
  const [modal, setModal] = useState(false); // ❌ Hook after return!
  useEffect(() => { ... }, []); // ❌ Hook after return!
}
```

**Example (✅ Correct):**
```typescript
export default function MyPage() {
  const [data, setData] = useState([]);
  const [modal, setModal] = useState(false); // ✅ All hooks first
  
  useEffect(() => { ... }, []); // ✅ All hooks first
  
  if (loading) return <Loading />; // Early returns after hooks
}
```

---

### 2. **Missing useEffect Wrapper**
**Problem**: `loadData` function defined inside `useEffect`, but another `useEffect` tries to call it.

**Solution**: Define `loadData` outside `useEffect`, then call it inside.

**Example (❌ Wrong):**
```typescript
useEffect(() => {
  const loadData = async () => { ... };
  
useEffect(() => {  // ❌ Missing closing brace!
  loadData();
}, []);
```

**Example (✅ Correct):**
```typescript
const loadData = async () => { ... }; // ✅ Defined outside

useEffect(() => {
  loadData();
}, []);
```

---

### 3. **Async Function in Non-Async Context**
**Problem**: Using `await` in a non-async function.

**Solution**: Make the function `async`.

**Example (❌ Wrong):**
```typescript
const confirmDelete = () => {
  await api.delete(id); // ❌ await in non-async function
};
```

**Example (✅ Correct):**
```typescript
const confirmDelete = async () => {
  await api.delete(id); // ✅ async function
};
```

---

## 🏗️ Industry Best Practices

### 1. **Component Structure (Standard Order)**

```typescript
export default function MyPage() {
  // 1. Hooks (useState, useEffect, useContext, etc.)
  const [state, setState] = useState();
  const { data } = useCustomHook();
  
  // 2. Derived state / computed values
  const filteredData = data.filter(...);
  
  // 3. Functions / handlers
  const handleClick = () => { ... };
  
  // 4. Effects (useEffect)
  useEffect(() => { ... }, []);
  
  // 5. Early returns (loading, error states)
  if (loading) return <Loading />;
  if (error) return <Error />;
  
  // 6. Main render
  return <div>...</div>;
}
```

---

### 2. **Data Fetching Pattern**

**✅ Recommended Pattern:**
```typescript
// Define loadData outside useEffect
const loadData = async () => {
  try {
    setLoading(true);
    const data = await api.getAll();
    setData(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

// Call in useEffect
useEffect(() => {
  loadData();
}, []);

// Reusable for reload events
useEffect(() => {
  const handleReload = () => loadData();
  window.addEventListener('reloadData', handleReload);
  return () => window.removeEventListener('reloadData', handleReload);
}, []);
```

**Benefits:**
- ✅ `loadData` can be called from multiple places
- ✅ Clear separation of concerns
- ✅ Easy to test
- ✅ No scope issues

---

### 3. **Error Handling**

**✅ Standard Pattern:**
```typescript
try {
  await api.call();
  showToast.success("Success");
} catch (err) {
  console.error("Error:", err);
  showToast.error(err instanceof Error ? err.message : "Failed");
}
```

---

### 4. **TypeScript Best Practices**

**✅ Always Type Props:**
```typescript
interface MyComponentProps {
  id: string;
  onClose: () => void;
  data?: MyDataType;
}

function MyComponent({ id, onClose, data }: MyComponentProps) {
  // ...
}
```

**✅ Use Type Guards:**
```typescript
if (err instanceof Error) {
  // TypeScript knows err is Error here
  console.error(err.message);
}
```

---

### 5. **Code Organization**

**✅ File Structure:**
```
page.tsx
├── Imports (React, Next.js, components, hooks, APIs)
├── Types/Interfaces
├── Constants/Config
├── Main Component
│   ├── Hooks (useState, useEffect, etc.)
│   ├── Derived State
│   ├── Functions
│   ├── Effects
│   ├── Early Returns
│   └── Main Render
└── Sub-components (modals, helpers)
```

---

## 🔧 Centralization Opportunities

### 1. **Custom Data Fetching Hook**

**Create**: `frontend/lib/hooks/useDataLoader.ts`

```typescript
export function useDataLoader<T>(
  fetchFn: () => Promise<T[]>,
  eventName?: string
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!eventName) return;
    const handleReload = () => loadData();
    window.addEventListener(eventName, handleReload);
    return () => window.removeEventListener(eventName, handleReload);
  }, [eventName]);

  return { data, loading, error, reload: loadData };
}
```

**Usage:**
```typescript
const { data: customers, loading, error } = useDataLoader(
  () => customersApi.getAll(),
  'reloadCustomers'
);
```

---

### 2. **Standardized Page Template**

**Create**: `frontend/components/PageTemplate.tsx`

```typescript
interface PageTemplateProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageTemplate({
  title,
  description,
  loading,
  error,
  children,
  actions,
}: PageTemplateProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">{title}</h1>
          {description && (
            <p className="text-sm text-base-content/60 mt-1">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
```

---

### 3. **ESLint Rules**

**Add to**: `frontend/.eslintrc.json`

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-floating-promises": "error"
  }
}
```

---

## 📊 Current Status

### ✅ **Fixed Issues:**
- ✅ `quality-checks/page.tsx` - Missing useEffect wrapper
- ✅ `returns/page.tsx` - Missing useEffect wrapper
- ✅ `stock-transfers/page.tsx` - Missing useEffect wrapper
- ✅ `anomalies/page.tsx` - Missing useEffect wrapper
- ✅ `packing/page.tsx` - Hooks after early returns
- ✅ `admins/page.tsx` - Async function fix
- ✅ `products/page.tsx` - Async function fix

### ⚠️ **Pages to Review:**
- `inventory/page.tsx`
- `shipments/page.tsx`
- `cycle-counts/page.tsx`
- `workers/page.tsx`
- `customers/page.tsx`
- `suppliers/page.tsx`
- `delivery-partners/page.tsx`
- `tasks/page.tsx`
- `orders/outbound/page.tsx`
- `orders/inbound/page.tsx`

---

## 🎯 Industry Standards Compliance

### ✅ **What We're Doing Right:**
1. ✅ **TypeScript** - Type safety throughout
2. ✅ **Component-based Architecture** - Reusable components
3. ✅ **API Abstraction** - Centralized API clients (`lib/api/*`)
4. ✅ **Error Handling** - Try-catch blocks with user feedback
5. ✅ **Loading States** - User-friendly loading indicators
6. ✅ **Theme System** - Centralized dark/light mode
7. ✅ **Route Protection** - Centralized authentication guard

### 🔄 **Areas for Improvement:**
1. 🔄 **Custom Hooks** - Extract common patterns (data loading, form handling)
2. 🔄 **ESLint Rules** - Enforce React hooks rules automatically
3. 🔄 **Error Boundaries** - Catch component errors gracefully
4. 🔄 **Code Splitting** - Lazy load heavy components
5. 🔄 **Testing** - Unit tests for hooks and utilities

---

## 📝 Recommendations

### **Immediate Actions:**
1. ✅ Fix all syntax errors (in progress)
2. 🔄 Add ESLint rules for hooks
3. 🔄 Create `useDataLoader` custom hook
4. 🔄 Standardize page structure across all pages

### **Future Enhancements:**
1. Add React Error Boundaries
2. Implement code splitting for large pages
3. Add unit tests for custom hooks
4. Create shared component library documentation

---

## ✅ **Summary**

**Current State**: ✅ **Industry Standard** with minor improvements needed

**Compliance:**
- ✅ React best practices
- ✅ TypeScript best practices
- ✅ Component architecture
- ✅ Error handling
- ✅ Code organization

**Next Steps:**
1. Complete syntax error fixes
2. Add ESLint rules
3. Create reusable hooks
4. Standardize patterns

---

**Status**: 🟢 **Good** - Following industry standards with room for optimization
