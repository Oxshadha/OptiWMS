# OptiWMS Documentation Index

This directory contains all documentation for the OptiWMS frontend project.

---

## 📚 Core Documentation

### Getting Started

- **[README.md](../README.md)** - Main project README with quick start guide

### System Architecture

- **[COMPLETE_SYSTEM_ARCHITECTURE.md](./COMPLETE_SYSTEM_ARCHITECTURE.md)** - Complete system architecture, including AI microservices, data flows, and implementation roadmap

### Roles and Permissions

- **[ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md)** - Comprehensive guide to all roles, permissions, and access control (consolidated from multiple role documents)
- **[ACCESS_CONTROL_MODEL.md](./ACCESS_CONTROL_MODEL.md)** - Detailed access control model, worker access assignment, and task assignment framework
- **[ROLE_TESTING_GUIDE.md](./ROLE_TESTING_GUIDE.md)** - Guide for testing role-based access control

### Implementation Status

- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - Comprehensive implementation status, what's complete, what's pending, and verification status (consolidated from multiple implementation documents)

### API Documentation

- **[API_ENDPOINTS.md](./API_ENDPOINTS.md)** - Complete API endpoints reference with permission requirements

### AI Services

- **[AI_SERVICES_IMPLEMENTATION.md](./AI_SERVICES_IMPLEMENTATION.md)** - Complete guide for implementing AI microservices (backend requirements, API specifications, integration points)

---

## 🎯 Feature-Specific Documentation

### Dashboard

- **[DASHBOARD_VISIBILITY_IMPLEMENTATION.md](./DASHBOARD_VISIBILITY_IMPLEMENTATION.md)** - Dashboard role-based visibility implementation guide

### Warehouse Layout

- **[warehouse-layout-guide.md](./warehouse-layout-guide.md)** - SVG-based warehouse layout visualization implementation guide
- **[VELOCITY_HEAT_MAP.md](./VELOCITY_HEAT_MAP.md)** - Velocity heat map visualization usage guide

### Operations

- **[DOCK_MANAGEMENT.md](./DOCK_MANAGEMENT.md)** - Dock management and yard trailer queue workflow
- **[LABOR_PRODUCTIVITY.md](./LABOR_PRODUCTIVITY.md)** - Labor productivity metrics and gamification guide
- **[OFFLINE_RESILIENCE.md](./OFFLINE_RESILIENCE.md)** - Offline-first PWA best practices and implementation

---

## 📋 Consolidated Documents

The following documents have been consolidated into the main documentation:

### Merged into ROLES_AND_PERMISSIONS.md:

- `optiwms-roles-updated.md` (original comprehensive roles document)
- `ROLE_TASKS_AND_RESTRICTIONS.md` (duplicate roles document)
- `Wraehouse manager and administrator roles diffrences.md` (role differences summary)

### Merged into IMPLEMENTATION_STATUS.md:

- `FULL_IMPLEMENTATION_COMPLETE.md` (implementation summary)
- `IMPLEMENTATION_SUMMARY.md` (implementation summary)
- `IMPLEMENTATION_VERIFICATION.md` (verification report)
- `ALL_FIXES_COMPLETE.md` (fixes summary)

### Merged into COMPLETE_SYSTEM_ARCHITECTURE.md:

- `AI microservices visibility and authority to roles.md` (AI services authority)
- `Core WMS system authority tand visisbility to roles.md` (Core WMS authority)

---

## 📖 Documentation Structure

```
docs/
├── README.md (this file)
│
├── Core Documentation
│   ├── COMPLETE_SYSTEM_ARCHITECTURE.md
│   ├── ROLES_AND_PERMISSIONS.md
│   ├── ACCESS_CONTROL_MODEL.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── API_ENDPOINTS.md
│   ├── AI_SERVICES_IMPLEMENTATION.md
│   └── ROLE_TESTING_GUIDE.md
│
└── Feature Documentation
    ├── DASHBOARD_VISIBILITY_IMPLEMENTATION.md
    ├── warehouse-layout-guide.md
    ├── VELOCITY_HEAT_MAP.md
    ├── DOCK_MANAGEMENT.md
    ├── LABOR_PRODUCTIVITY.md
    └── OFFLINE_RESILIENCE.md
```

---

## 🔍 Quick Reference

### I want to understand...

**...roles and permissions:**
→ Start with [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md)

**...what's implemented:**
→ Check [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)

**...the system architecture:**
→ Read [COMPLETE_SYSTEM_ARCHITECTURE.md](./COMPLETE_SYSTEM_ARCHITECTURE.md)

**...API endpoints:**
→ See [API_ENDPOINTS.md](./API_ENDPOINTS.md)

**...how to test roles:**
→ Follow [ROLE_TESTING_GUIDE.md](./ROLE_TESTING_GUIDE.md)

**...warehouse layout:**
→ Read [warehouse-layout-guide.md](./warehouse-layout-guide.md)

**...access control:**
→ See [ACCESS_CONTROL_MODEL.md](./ACCESS_CONTROL_MODEL.md)

**...AI services implementation:**
→ Read [AI_SERVICES_IMPLEMENTATION.md](./AI_SERVICES_IMPLEMENTATION.md)

**...dock management:**
→ Read [DOCK_MANAGEMENT.md](./DOCK_MANAGEMENT.md)

**...labor productivity:**
→ Read [LABOR_PRODUCTIVITY.md](./LABOR_PRODUCTIVITY.md)

**...velocity heat map:**
→ Read [VELOCITY_HEAT_MAP.md](./VELOCITY_HEAT_MAP.md)

**...offline resilience:**
→ Read [OFFLINE_RESILIENCE.md](./OFFLINE_RESILIENCE.md)

---

## 📝 Document Status

| Document                               | Status     | Last Updated |
| -------------------------------------- | ---------- | ------------ |
| ROLES_AND_PERMISSIONS.md               | ✅ Current | Consolidated |
| IMPLEMENTATION_STATUS.md               | ✅ Current | Consolidated |
| COMPLETE_SYSTEM_ARCHITECTURE.md        | ✅ Current | Current      |
| API_ENDPOINTS.md                       | ✅ Current | Current      |
| ACCESS_CONTROL_MODEL.md                | ✅ Current | Current      |
| ROLE_TESTING_GUIDE.md                  | ✅ Current | Current      |
| DASHBOARD_VISIBILITY_IMPLEMENTATION.md | ✅ Current | Current      |
| warehouse-layout-guide.md              | ✅ Current | Current      |
| AI_SERVICES_IMPLEMENTATION.md          | ✅ Current | New          |
| DOCK_MANAGEMENT.md                     | ✅ Current | New          |
| LABOR_PRODUCTIVITY.md                  | ✅ Current | New          |
| VELOCITY_HEAT_MAP.md                   | ✅ Current | New          |
| OFFLINE_RESILIENCE.md                  | ✅ Current | New          |

---

## 🔄 Documentation Maintenance

### When to Update Documentation

1. **New Features**: Add documentation for new features
2. **Role Changes**: Update ROLES_AND_PERMISSIONS.md when roles change
3. **API Changes**: Update API_ENDPOINTS.md when APIs change
4. **Implementation**: Update IMPLEMENTATION_STATUS.md when features are completed
5. **Architecture Changes**: Update COMPLETE_SYSTEM_ARCHITECTURE.md for architectural changes

### Documentation Standards

- Use clear, descriptive headings
- Include code examples where helpful
- Link to related documentation
- Keep tables of contents updated
- Mark implementation status clearly

---

_Last Updated: Documentation consolidation and organization_
