# Development Guide

Complete guide for developing OptiWMS with conflict prevention and best practices.

## Table of Contents
- [Development Environment Setup](#development-environment-setup)
- [Git Workflow](#git-workflow)
- [Conflict Prevention Strategies](#conflict-prevention-strategies)
- [Working with AI Tools](#working-with-ai-tools)
- [Team Coordination](#team-coordination)
- [Testing Guidelines](#testing-guidelines)
- [Troubleshooting](#troubleshooting)

## Development Environment Setup

### Prerequisites Installation
```bash
# Node.js (Frontend)
node --version  # Should be 18+
npm --version

# Java (Backend)
java -version  # Should be 17+

# PostgreSQL (Database)
psql --version  # Should be 14+

# Git
git --version
```

### Initial Project Setup
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/OptiWMS.git
cd OptiWMS

# Frontend setup
cd frontend
npm install
cp .env.example .env.local  # If exists
npm run dev

# Backend setup (in another terminal)
cd backend
./gradlew build
./gradlew bootRun

# Database setup
# Follow database migration instructions
```

### IDE Configuration
**VS Code Recommended Extensions:**
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- GitLens

**Settings (`.vscode/settings.json`):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Git Workflow

### Daily Workflow

#### Morning Routine
```bash
# 1. Update main branch
git checkout main
git pull origin main

# 2. Check for active branches
git branch -r

# 3. Create/switch to your feature branch
git checkout -b feature/your-feature-name
# OR continue existing branch
git checkout feature/your-feature-name
git pull origin feature/your-feature-name
```

#### During Development
```bash
# Make changes, test locally
# Commit frequently
git add .
git commit -m "feat(scope): description"

# Push to remote
git push origin feature/your-feature-name
```

#### End of Day
```bash
# Commit any uncommitted work
git add .
git commit -m "WIP: work in progress description"

# Push to remote
git push origin feature/your-feature-name

# Optional: Sync with main
git checkout main
git pull origin main
git checkout feature/your-feature-name
git merge main  # Or git rebase main
```

### Branch Management

#### Creating Branches
```bash
# Feature branch
git checkout -b feature/user-authentication

# Bug fix
git checkout -b fix/login-error

# Refactoring
git checkout -b refactor/api-structure
```

#### Branch Naming Checklist
- ✅ Uses prefix: `feature/`, `fix/`, `refactor/`, etc.
- ✅ Descriptive name (kebab-case)
- ✅ No special characters
- ✅ Related to issue/task

#### Deleting Branches
```bash
# Delete local branch (after merge)
git branch -d feature/your-feature-name

# Delete remote branch
git push origin --delete feature/your-feature-name
```

### Pull Request Process

#### Before Creating PR
```bash
# 1. Ensure branch is up to date
git checkout main
git pull origin main
git checkout feature/your-feature-name
git merge main  # Resolve any conflicts

# 2. Test locally
npm run dev  # Frontend
./gradlew test  # Backend

# 3. Push latest changes
git push origin feature/your-feature-name
```

#### PR Checklist
- [ ] Code follows project conventions
- [ ] No merge conflicts
- [ ] All tests pass
- [ ] Documentation updated (if needed)
- [ ] Screenshots added (for UI changes)
- [ ] PR description is clear
- [ ] Related issues referenced

#### After PR Approval
```bash
# Merge on GitHub (use "Squash and merge" for cleaner history)
# Then clean up locally
git checkout main
git pull origin main
git branch -d feature/your-feature-name
```

## Conflict Prevention Strategies

### 1. File-Level Separation

#### Team Member Assignments
**Assign specific areas to each developer:**

| Member | Primary Area | Files/Paths |
|--------|-------------|-------------|
| Member 1 | Admin Dashboard | `app/admin/*`, `app/(admin)/*` |
| Member 2 | Worker PWA | `app/worker/*`, `app/(worker)/*` |
| Member 3 | Backend API | `backend/core-api/*` |
| Member 4 | AI Services | `ai-services/*`, `infra/*` |

**Rules:**
- Work primarily in your assigned area
- Communicate before working in others' areas
- Check active branches before starting work

#### Checking Active Work
```bash
# See all remote branches
git branch -r

# See what files changed in a branch
git diff main..origin/feature/branch-name --name-only

# Check if someone is working on a file
git log --all --oneline -- path/to/file.tsx
```

### 2. Component Ownership

#### Before Creating Components
```bash
# Search for existing components
find frontend/components -name "*ComponentName*"
grep -r "ComponentName" frontend/

# Check if similar exists
ls frontend/components/
```

#### Component Naming Rules
- **Check existing patterns** before creating
- **Use consistent naming**: `{Feature}{Type}.tsx`
- **Avoid duplicates**: Search before creating
- **Communicate**: Announce new shared components

### 3. Route Management

#### Route Naming Rules
- **Use kebab-case**: `/order-details`, `/warehouse-management`
- **Be descriptive**: Clear, not abbreviated
- **Check conflicts**: Search existing routes
- **Follow patterns**: Match existing structure

#### Checking Routes
```bash
# List all routes
find frontend/app -name "page.tsx" | grep -v node_modules

# Check for route conflicts
grep -r "href=\"/your-route\"" frontend/
```

### 4. Database Changes

#### Migration Protocol
1. **Announce in team chat** before creating migration
2. **Use Flyway naming**: `V{version}__{description}.sql`
3. **Test locally** before committing
4. **Coordinate timing** - Don't merge conflicting migrations

#### Migration Naming
```
V1__initial_schema.sql
V2__add_user_table.sql
V3__add_warehouse_indexes.sql
```

### 5. Configuration Files

#### Shared Config Files
**Files that need coordination:**
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `tailwind.config.ts` - Tailwind config
- `.env.example` - Environment variables template

**Protocol:**
1. **Announce changes** in team chat
2. **Make small, focused changes**
3. **Test after merging** config changes
4. **Document changes** in commit message

## Working with AI Tools

### Standard AI Prompt Template

**Always include this context:**
```
I'm working on OptiWMS project. Please:
1. Read CONTRIBUTING.md for conventions
2. Follow FRONTEND_STRUCTURE.md for frontend work
3. Check API_DOCUMENTATION.md for API endpoints
4. Use existing code patterns from the codebase
5. Follow naming conventions (kebab-case for files, PascalCase for components)
```

### AI Tool Coordination

#### Different AI Tools, Same Codebase
**To prevent conflicts:**

1. **Share Context Files**
   - Always include project docs in AI prompts
   - Reference existing code patterns
   - Use consistent naming conventions

2. **Code Review Before Commit**
   ```bash
   # Review AI-generated code
   git diff
   
   # Check against existing patterns
   grep -r "similar-pattern" frontend/
   
   # Test locally
   npm run dev
   ```

3. **Standardize Prompts**
   - Create shared prompt templates
   - Document AI tool usage
   - Review AI output before committing

#### AI-Generated Code Checklist
Before committing AI-generated code:
- [ ] Naming matches project conventions
- [ ] Uses existing utilities/components
- [ ] Follows routing patterns
- [ ] Matches styling approach
- [ ] No placeholder comments
- [ ] Tested locally
- [ ] Reviewed manually

### Component Generation with AI

#### Before Asking AI to Create Component
```bash
# 1. Search existing components
find frontend/components -name "*.tsx"

# 2. Check for similar functionality
grep -r "similar-feature" frontend/

# 3. Check API documentation
cat API_DOCUMENTATION.md | grep "endpoint-name"
```

#### AI Component Prompt
```
Create a React component for [feature] in OptiWMS:
- Use TypeScript
- Follow existing component patterns in components/
- Use Tailwind CSS + DaisyUI
- Use Material Symbols for icons
- Component name: [PascalCase]
- File location: components/[ComponentName].tsx
- Reference similar components: [list existing]
```

## Team Coordination

### Daily Standup
**Share:**
- What you're working on
- Any blockers
- Files you're modifying
- Expected completion time

### Communication Channels
- **GitHub Issues** - Bugs and features
- **Pull Requests** - Code review
- **Team Chat** - Quick coordination
- **Project Board** - Task tracking

### Conflict Prevention Communication

#### Before Starting Work
```
"I'm starting work on [feature] in [file/area].
Expected completion: [timeframe].
Files I'll modify: [list]."
```

#### When Working on Shared Files
```
"I need to modify [shared-file].
Is anyone else working on this?
I'll coordinate changes."
```

#### When Blocked
```
"I'm blocked on [issue].
Need help with: [description].
Files affected: [list]."
```

### File Conflict Protocol

#### If Conflict Detected
1. **Stop work** on conflicting file
2. **Communicate** with team member
3. **Coordinate** merge strategy
4. **Resolve together** if needed
5. **Test** after resolution

## Testing Guidelines

### Frontend Testing
```bash
# Development server
cd frontend
npm run dev

# Build test
npm run build

# Type checking
npx tsc --noEmit
```

### Backend Testing
```bash
# Run tests
cd backend
./gradlew test

# Build
./gradlew build

# Run application
./gradlew bootRun
```

### Integration Testing
- Test API endpoints with frontend
- Verify offline functionality (when implemented)
- Test cross-browser compatibility

## Troubleshooting

### Merge Conflicts

#### Prevention
```bash
# Update frequently
git checkout main
git pull origin main
git checkout your-branch
git merge main  # Resolve conflicts early
```

#### Resolution
```bash
# When conflict occurs
git status  # See conflicted files

# Edit files to resolve conflicts
# Look for <<<<<<< HEAD markers

# After resolving
git add .
git commit -m "Merge main into feature branch"
```

### Common Issues

#### "File not found" Errors
- Check file path matches route
- Verify file exists in correct location
- Check for typos

#### Styling Not Applied
- Clear browser cache
- Restart dev server
- Check Tailwind config
- Verify DaisyUI theme

#### API Connection Issues
- Check backend is running
- Verify API URL in `.env.local`
- Check CORS settings
- Verify authentication

### Getting Help

1. **Check Documentation**
   - `CONTRIBUTING.md`
   - `FRONTEND_STRUCTURE.md`
   - `API_DOCUMENTATION.md`

2. **Search Existing Code**
   - Look for similar implementations
   - Check existing patterns

3. **Ask Team**
   - Create GitHub Discussion
   - Ask in team chat
   - Request code review

## Best Practices Summary

### Do's ✅
- ✅ Update from main frequently
- ✅ Use descriptive branch names
- ✅ Commit small, logical changes
- ✅ Test before committing
- ✅ Communicate with team
- ✅ Follow naming conventions
- ✅ Review AI-generated code
- ✅ Document your changes

### Don'ts ❌
- ❌ Work directly on main
- ❌ Commit large, unrelated changes
- ❌ Ignore merge conflicts
- ❌ Create duplicate components
- ❌ Use inconsistent naming
- ❌ Skip testing
- ❌ Work in isolation without communication
- ❌ Commit AI code without review

## Resources

- [Git Best Practices](https://git-scm.com/book)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

**Remember**: Communication and coordination are key to preventing conflicts. When in doubt, ask your team!

