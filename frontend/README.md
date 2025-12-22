# OptiWMS Frontend

A comprehensive Warehouse Management System (WMS) frontend built with Next.js 14, React, and TypeScript. OptiWMS provides role-based access control, AI microservices integration, and a complete warehouse management interface for both administrators and warehouse workers.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (see backend documentation)

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at `http://localhost:3000`

---

## 📋 Features

### Admin Dashboard

- **Role-Based Access Control**: Three admin roles (System Administrator, Warehouse Manager, Inbound Coordinator)
- **Dashboard**: Role-specific KPIs, AI service panels, and quick actions
- **Warehouse Management**: Multi-warehouse support with layout visualization
- **Inventory Management**: Real-time inventory tracking and cycle counts
- **Order Management**: Inbound and outbound order processing
- **Task Management**: Worker task assignment and tracking
- **Reports**: Comprehensive reporting and analytics
- **Dock Management**: Yard trailer queue and dock appointment scheduling (Inbound Coordinator)
- **Labor Productivity**: Worker performance metrics, PPH tracking, and leaderboards (Warehouse Manager)
- **Velocity Heat Map**: Activity velocity visualization for warehouse optimization

### Worker PWA

- **Role-Based Operations**: 11 worker roles with operation-specific access
- **Mobile-First Design**: Optimized for handheld devices
- **Offline Support**: IndexedDB caching for offline operation with automatic sync
- **Task Execution**: Receiving, putaway, picking, packing, cycle counts, and more
- **Blind Receiving**: Hide PO quantities to improve receiving accuracy
- **Leaderboard**: Gamification with performance rankings and achievement badges
- **Offline-First**: Complete task execution even in Wi-Fi dead zones

### AI Microservices Integration

- **Service Registry**: Pluggable AI service architecture
- **Graceful Degradation**: Core WMS works independently of AI services
- **Role-Based Access**: Different AI services accessible by different roles
- **Health Monitoring**: Real-time service status indicators

---

## 🏗️ Architecture

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS + DaisyUI
- **State Management**: React Context API
- **Storage**: IndexedDB (for offline support)
- **Charts**: Recharts

### Project Structure

```
frontend/
├── app/                    # Next.js app router pages
│   ├── (admin)/           # Admin route group
│   │   ├── dashboard/     # Admin dashboard
│   │   └── warehouses/    # Warehouse management
│   ├── admin/             # Admin pages
│   │   ├── workers/       # Worker management
│   │   ├── inventory/      # Inventory management
│   │   ├── orders/        # Order management
│   │   └── ...           # Other admin pages
│   └── worker/            # Worker PWA pages
│       ├── receiving/     # Receiving operations
│       ├── picking/       # Picking operations
│       └── ...           # Other worker pages
├── components/             # Reusable React components
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── Topbar.tsx         # Top navigation bar
│   ├── WarehouseLayout.tsx # Warehouse visualization
│   └── ...                # Other components
├── contexts/               # React contexts
│   ├── AdminContext.tsx   # Admin authentication
│   └── WorkerContext.tsx  # Worker authentication
├── lib/                    # Utility libraries
│   ├── admin-roles.ts     # Admin role permissions
│   ├── worker-roles.ts    # Worker role definitions
│   ├── ai-services/       # AI service integration
│   │   ├── registry.ts    # Service registry
│   │   └── client.ts     # API client
│   └── api/               # API clients
│       ├── warehouses.ts  # Warehouses API
│       ├── materials.ts   # Materials API
│       └── ...           # Other API clients
├── hooks/                  # Custom React hooks
│   └── useAIService.ts    # AI service hook
└── docs/                   # Documentation
    ├── ROLES_AND_PERMISSIONS.md
    ├── IMPLEMENTATION_STATUS.md
    └── ...                # Other documentation
```

---

## 👥 Roles and Permissions

### Admin Roles

1. **System Administrator** (`admin`)

   - Full access to all features
   - User management
   - System configuration
   - AI service configuration

2. **Warehouse Manager** (`warehouse_manager`)

   - Operational warehouse management
   - Worker task assignment
   - Inventory accuracy management
   - Order fulfillment
   - Single warehouse scope

3. **Inbound Coordinator** (`inbound_coordinator`)
   - Inbound receipt coordination
   - Purchase order documentation
   - ERP integration
   - Dock scheduling
   - Supplier coordination
   - All warehouses scope

### Worker Roles

11 worker roles with operation-specific access:

- Forklift Operator
- Stacker Operator
- Powered Pallet Truck Operator
- Unloading Worker
- Cycle Count Worker
- Picker
- Packer
- Shipment Worker
- Returns Worker
- Vehicle Inspector
- Warehouse Safekeeping Worker

**For detailed role permissions, see [Roles and Permissions Guide](./docs/ROLES_AND_PERMISSIONS.md)**

---

## 🔌 API Integration

### Base Configuration

API base URL is configured in `lib/api/client.ts`. Update the base URL for your environment:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
```

### Implemented APIs

- ✅ Warehouses (`/master/warehouses`)
- ✅ Materials/Products (`/master/materials`)
- ✅ Inventory (`/inventory`)
- ✅ Stock Transfers (`/operations/stock-transfers`)

### Mock Data

Some pages currently use mock data. These will be replaced with API calls:

- Delivery Partners
- Suppliers
- Returns
- Orders
- Shipments
- Workers
- Tasks

**For complete API documentation, see [API Endpoints](./docs/API_ENDPOINTS.md)**

---

## 🤖 AI Microservices

### Architecture

The AI microservices are designed as a pluggable advisory layer:

- Core WMS works independently
- AI services provide suggestions (never automatic execution)
- Human-in-the-loop for all AI recommendations
- Graceful degradation when services unavailable

### Available Services

1. **Demand Forecasting** - Predicts future demand
2. **Min-Max Inventory** - Suggests optimal inventory levels
3. **Optimal Storage** - Suggests storage locations
4. **Optimal Picking Path** - Suggests efficient picking paths
5. **Anomaly Detection** - Detects operational anomalies
6. **Procurement Agent** - Multi-system reasoning for procurement

### Service Access by Role

| Service              | Admin | Warehouse Manager | Inbound Coordinator |
| -------------------- | ----- | ----------------- | ------------------- |
| Demand Forecasting   | Full  | View-only         | View-only           |
| Min-Max Inventory    | Full  | View-only         | View-only           |
| Optimal Storage      | Full  | Primary           | No                  |
| Optimal Picking Path | Full  | Primary           | No                  |
| Anomaly Detection    | Full  | Operational       | Supplier            |
| Procurement Agent    | Full  | No                | View-only           |

### Human-in-the-Loop Feedback

- **Feedback Collection**: Capture reasons when AI suggestions are rejected/deferred
- **Model Improvement**: Feedback data used to improve AI accuracy over time
- **Reason Codes**: Structured feedback (e.g., "Too heavy for top shelf", "Aisle blocked")
- **Integration Points**: Optimal Storage, Optimal Picking Path, Min-Max Inventory

**For detailed AI service documentation, see:**

- [AI Services Implementation Guide](./docs/AI_SERVICES_IMPLEMENTATION.md) - Backend implementation requirements and API specifications
- [Complete System Architecture](./docs/COMPLETE_SYSTEM_ARCHITECTURE.md) - Full system architecture

---

## 📱 Worker PWA

### Features

- **Offline Support**: IndexedDB caching for offline operation
- **Role-Based Access**: Workers only see operations they're authorized for
- **Task Management**: View and execute assigned tasks
- **Barcode Scanning**: QR code and barcode scanning support
- **Location Picker**: Hierarchical location selection

### Worker Login

Workers can log in at `/worker/login`. The system supports:

- Role-based authentication
- Offline data storage
- Task synchronization

**For worker role testing, see [Role Testing Guide](./docs/ROLE_TESTING_GUIDE.md)**

---

## 🗺️ Warehouse Layout Visualization

The system includes an SVG-based warehouse layout visualization:

- Multi-warehouse support
- Occupancy-based color coding
- Level segment visualization
- Rack status management
- Side elevation view

**For detailed documentation, see [Warehouse Layout Guide](./docs/warehouse-layout-guide.md)**

---

## 🧪 Testing

### Manual Testing

1. **Role-Based Access**: Test different roles and verify access restrictions
2. **Permission Checks**: Verify buttons/actions are hidden based on permissions
3. **Route Protection**: Test unauthorized route access
4. **AI Services**: Test AI service panels and fallback behavior

**For testing procedures, see [Role Testing Guide](./docs/ROLE_TESTING_GUIDE.md)**

### Development Testing

```bash
# Run linter
npm run lint

# Type checking (via TypeScript)
npm run build
```

---

## 📚 Documentation

### Core Documentation

- **[Roles and Permissions](./docs/ROLES_AND_PERMISSIONS.md)** - Complete role definitions and permissions
- **[Implementation Status](./docs/IMPLEMENTATION_STATUS.md)** - What's implemented and what's pending
- **[Complete System Architecture](./docs/COMPLETE_SYSTEM_ARCHITECTURE.md)** - Full system architecture
- **[API Endpoints](./docs/API_ENDPOINTS.md)** - API reference documentation
- **[Access Control Model](./docs/ACCESS_CONTROL_MODEL.md)** - Access control implementation details

### Feature Documentation

- **[Warehouse Layout Guide](./docs/warehouse-layout-guide.md)** - Warehouse visualization system
  -\- **[Velocity Heat Map](./docs/VELOCITY_HEAT_MAP.md)** - Activity velocity visualization guide
- **[Role Testing Guide](./docs/ROLE_TESTING_GUIDE.md)** - How to test role-based access
- **[Dashboard Visibility](./docs/DASHBOARD_VISIBILITY_IMPLEMENTATION.md)** - Dashboard implementation
- **[Dock Management](./docs/DOCK_MANAGEMENT.md)** - Dock scheduling and yard management
- **[Labor Productivity](./docs/LABOR_PRODUCTIVITY.md)** - Worker performance metrics and gamification
- **[Offline Resilience](./docs/OFFLINE_RESILIENCE.md)** - Offline-first PWA best practices

### Documentation Index

See [Documentation Index](./docs/README.md) for a complete list of all documentation files.

---

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080

# AI Services Configuration
NEXT_PUBLIC_AI_SERVICES_URL=http://localhost:8080/ai-services

# Environment
NODE_ENV=development
```

### Role Configuration

Roles are configured in:

- `lib/admin-roles.ts` - Admin roles and permissions
- `lib/worker-roles.ts` - Worker roles and operations

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Docker Deployment

A `Dockerfile` is included for containerized deployment:

```bash
docker build -t optiwms-frontend .
docker run -p 3000:3000 optiwms-frontend
```

---

## 🤝 Contributing

1. Follow the existing code style
2. Add TypeScript types for all new code
3. Update documentation for new features
4. Test role-based access for new pages
5. Ensure graceful degradation for AI services

---

## 📝 License

[Add your license information here]

---

## 🆘 Support

For questions or issues:

1. Check documentation in `docs/` folder
2. Review [Implementation Status](./docs/IMPLEMENTATION_STATUS.md)
3. Check [API Endpoints](./docs/API_ENDPOINTS.md) for API issues

---

## 🔗 Related Projects

- **Backend**: [Link to backend repository]
- **AI Services**: [Link to AI services repository]

---

_Last Updated: 2025-01-XX_
