# Contributing to OptiWMS

Thank you for contributing to OptiWMS! This guide will help you contribute effectively and prevent conflicts.

## Table of Contents
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Naming Conventions](#naming-conventions)
- [Conflict Prevention](#conflict-prevention)
- [AI-Assisted Development Guidelines](#ai-assisted-development-guidelines)
- [Code Review Process](#code-review-process)
- [Commit Guidelines](#commit-guidelines)

## Getting Started

### Prerequisites
- Git installed and configured
- Node.js 18+ (for frontend)
- Java 17+ (for backend)
- PostgreSQL 14+ (for database)
- Your IDE of choice (VS Code recommended)

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/OptiWMS.git
cd OptiWMS

# Install frontend dependencies
cd frontend
npm install

# Setup backend (if needed)
cd ../backend
./gradlew build
```

## Development Workflow

### 1. Always Start from Main
```bash
# Update your local main branch
git checkout main
git pull origin main
```

### 2. Create a Feature Branch
```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name
# OR
git checkout -b fix/bug-description
# OR
git checkout -b refactor/component-name
```

### 3. Work on Your Feature
- Make your changes
- Test thoroughly
- Commit frequently with clear messages

### 4. Keep Your Branch Updated
```bash
# Regularly sync with main to prevent conflicts
git checkout main
git pull origin main
git checkout your-branch-name
git merge main
# OR use rebase (preferred for cleaner history)
git rebase main
```

### 5. Push and Create Pull Request
```bash
# Push your branch
git push origin your-branch-name

# Create a Pull Request on GitHub
# Wait for review and approval before merging
```

## Branching Strategy

### Branch Naming Convention
Use prefixes to categorize branches:

- `feature/` - New features (e.g., `feature/user-authentication`)
- `fix/` - Bug fixes (e.g., `fix/login-error`)
- `refactor/` - Code refactoring (e.g., `refactor/api-structure`)
- `docs/` - Documentation updates (e.g., `docs/api-documentation`)
- `test/` - Adding tests (e.g., `test/warehouse-service`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### Branch Structure
```
main (production-ready)
  ├── develop (integration branch)
  │   ├── feature/user-dashboard
  │   ├── feature/inventory-management
  │   ├── fix/cycle-count-bug
  │   └── refactor/api-layer
```

### Branch Assignment by Team Member
**Assign specific areas to prevent conflicts:**

- **Member 1**: Admin Dashboard (`/app/admin/*`, `/app/(admin)/*`)
- **Member 2**: Worker PWA (`/app/worker/*`, `/app/(worker)/*`)
- **Member 3**: Backend API (`/backend/core-api/*`)
- **Member 4**: AI Services & Infrastructure (`/ai-services/*`, `/infra/*`)

**If you need to work on someone else's area:**
1. **Communicate first** - Use team chat/issue tracker
2. **Check for active branches** - `git branch -r`
3. **Coordinate** - Avoid simultaneous changes to same files

## Naming Conventions

### File and Folder Names
- **Use kebab-case**: `user-profile.tsx`, `warehouse-service.java`
- **Components**: PascalCase for React components (`UserProfile.tsx`)
- **Utilities**: camelCase for functions (`fetchWarehouses.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Frontend Routes
- **Admin routes**: `/admin/*` (e.g., `/admin/dashboard`, `/admin/orders`)
- **Worker routes**: `/worker/*` (e.g., `/worker/tasks`, `/worker/picking`)
- **Use route groups**: `(admin)` and `(worker)` for layouts

### API Endpoints
- **RESTful conventions**: `/api/{resource}/{id}`
- **Use plural nouns**: `/api/warehouses`, `/api/orders`
- **Version if needed**: `/api/v1/warehouses`

### Database Tables
- **snake_case**: `warehouse_items`, `order_details`
- **Plural nouns**: `warehouses`, `orders`, `customers`

### Variables and Functions
- **camelCase**: `userName`, `fetchOrders()`, `calculateTotal()`
- **Boolean prefixes**: `isActive`, `hasPermission`, `canEdit`
- **Descriptive names**: Avoid abbreviations unless widely known

## Conflict Prevention

### 1. File-Level Separation
**Each team member should work on different files when possible:**
- Member 1: `app/admin/dashboard/page.tsx`
- Member 2: `app/worker/picking/page.tsx`
- Member 3: `backend/core-api/orders/OrderController.java`
- Member 4: `ai-services/demand-forecast-service/main.py`

### 2. Component Ownership
**Before creating a new component:**
1. Check if it exists: `grep -r "ComponentName" frontend/`
2. Check active branches: `git branch -r | grep feature`
3. Communicate in team chat

### 3. Shared Files Protocol
**For shared files (e.g., `globals.css`, `layout.tsx`):**
1. **Coordinate changes** - Announce in team chat
2. **Make small, focused changes** - Easier to merge
3. **Update frequently** - Pull main daily
4. **Use feature flags** - If possible, use conditional rendering

### 4. Database Changes
**For schema changes:**
1. **Create migration files** - Use Flyway naming: `V{version}__{description}.sql`
2. **Coordinate with team** - Database changes affect everyone
3. **Test migrations** - Ensure they work both up and down
4. **Document changes** - Update ERD if needed

### 5. Configuration Files
**For shared config files (`.env`, `package.json`, etc.):**
- **Never commit `.env` files** - Use `.env.example`
- **Coordinate `package.json` changes** - Announce dependency additions
- **Merge carefully** - Review dependency conflicts

## AI-Assisted Development Guidelines

### Preventing AI-Generated Conflicts

#### 1. Use Consistent Prompts
**Create a shared prompt template:**
```
When generating code for OptiWMS:
- Use kebab-case for file names
- Use camelCase for variables
- Follow existing code style
- Use TypeScript for frontend
- Use Java Spring Boot conventions for backend
- Reference existing components before creating new ones
```

#### 2. Review AI-Generated Code
**Before committing AI-generated code:**
- ✅ Check naming conventions match project standards
- ✅ Verify imports use existing utilities
- ✅ Ensure routing follows established patterns
- ✅ Test that it doesn't conflict with existing features
- ✅ Remove any AI-specific comments or placeholders

#### 3. Component Reuse
**Before asking AI to create a component:**
1. Search existing components: `find frontend/components -name "*.tsx"`
2. Check if similar component exists
3. If creating new, use consistent naming: `{Feature}{Type}.tsx`
   - Examples: `WarehouseCard.tsx`, `OrderTable.tsx`, `TaskList.tsx`

#### 4. API Integration
**When AI suggests API endpoints:**
1. Check `API_DOCUMENTATION.md` for existing endpoints
2. Verify endpoint naming follows REST conventions
3. Use existing API client utilities from `frontend/lib/api.ts`
4. Coordinate with backend developer if new endpoint needed

#### 5. Styling Consistency
**For AI-generated UI:**
- Use Tailwind CSS classes (not inline styles)
- Follow DaisyUI component patterns
- Match existing color scheme (see `Ui color pallet.md` in Resources)
- Use Material Symbols for icons: `<span className="material-symbols-outlined">icon_name</span>`

### AI Tool Coordination

#### Different AI Tools, Same Project
**To prevent conflicts when using different AI tools:**

1. **Share Context Files**
   - Always include `CONTRIBUTING.md` in your AI prompts
   - Reference `FRONTEND_STRUCTURE.md` for frontend work
   - Reference `API_DOCUMENTATION.md` for API work

2. **Standard Prompts**
   ```
   "I'm working on OptiWMS. Please:
   - Read CONTRIBUTING.md for conventions
   - Follow the structure in FRONTEND_STRUCTURE.md
   - Use existing patterns from the codebase
   - Check API_DOCUMENTATION.md for endpoints"
   ```

3. **Code Review Before Commit**
   - Always review AI-generated code manually
   - Compare with existing code patterns
   - Test locally before pushing

## Code Review Process

### Before Submitting PR
- [ ] Code follows naming conventions
- [ ] No merge conflicts with main
- [ ] All tests pass (if applicable)
- [ ] Documentation updated (if needed)
- [ ] No console.logs or debug code
- [ ] TypeScript/Java compiles without errors

### PR Checklist
- [ ] Clear description of changes
- [ ] Reference related issues
- [ ] Screenshots (for UI changes)
- [ ] Test instructions
- [ ] Breaking changes documented

### Review Guidelines
- Be constructive and respectful
- Focus on code quality, not personal preferences
- Approve when ready, request changes when needed
- Merge only after approval from at least one reviewer

## Commit Guidelines

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

### Examples
```bash
feat(admin): add warehouse management page
fix(worker): resolve picking path calculation error
docs(api): update endpoint documentation
refactor(frontend): restructure component hierarchy
```

### Commit Frequency
- **Commit often** - Small, logical commits
- **One feature per commit** - Don't mix unrelated changes
- **Test before commit** - Ensure code works

## Communication

### Team Coordination
- **Daily standup** - Share what you're working on
- **Blockers** - Communicate immediately if blocked
- **File conflicts** - Announce before working on shared files
- **Breaking changes** - Announce and coordinate

### Tools
- **GitHub Issues** - For bugs and features
- **Pull Requests** - For code review
- **Team Chat** - For quick coordination
- **Project Board** - For task tracking

## Getting Help

- **Documentation**: Check `docs/` folder
- **API Docs**: See `API_DOCUMENTATION.md`
- **Frontend Guide**: See `FRONTEND_STRUCTURE.md`
- **Development Guide**: See `DEVELOPMENT_GUIDE.md`
- **Questions**: Create a GitHub Discussion or ask in team chat

## Additional Resources

- [Frontend Structure Guide](./FRONTEND_STRUCTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Development Guide](./DEVELOPMENT_GUIDE.md)
- [Git Best Practices](https://git-scm.com/book)

---

**Remember**: Communication is key! When in doubt, ask your team members before making changes that might conflict.

