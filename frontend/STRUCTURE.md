# OptiWMS - Application Structure

## Overview

OptiWMS is a Warehouse Management System built with Next.js 14, React, TypeScript, and DaisyUI. The application uses role-based access with separate interfaces for Administrators and Workers.

---

## 📁 Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── (admin)/                  # Admin route group
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Admin dashboard
│   │   └── layout.tsx            # Admin layout wrapper
│   │
│   ├── (worker)/                 # Worker route group
│   │   ├── cycle-count/
│   │   ├── picking/
│   │   ├── putaway/
│   │   ├── receiving/
│   │   ├── returns/
│   │   ├── shipments/
│   │   ├── tasks/
│   │   │   └── [id]/            # Dynamic task detail page
│   │   ├── profile/
│   │   ├── page.tsx              # Worker home page
│   │   └── layout.tsx            # Worker layout
│   │
│   ├── admin/                    # Admin pages
│   │   ├── dashboard/            # Dashboard (redirects to (admin)/dashboard)
│   │   ├── warehouses/           # Warehouse management
│   │   ├── orders/               # Order management
│   │   │   └── create/           # Create new order
│   │   ├── shipments/            # Shipment management
│   │   │   └── create/           # Create new shipment
│   │   ├── inventory/            # Inventory management
│   │   │   └── create/           # Create inventory item
│   │   ├── customers/            # Customer management
│   │   │   └── create/           # Create new customer
│   │   ├── returns/              # Returns management
│   │   ├── reports/              # Reports & exports
│   │   │   └── custom/           # Custom report builder
│   │   ├── system/               # System Administrator
│   │   ├── settings/             # User settings
│   │   ├── help/                 # Help center
│   │   ├── login/                # Admin login
│   │   ├── page.tsx              # Admin home page
│   │   └── layout.tsx            # Admin layout (with sidebar/topbar)
│   │
│   ├── worker/                    # Worker pages (duplicate routes)
│   │   ├── cycle-count/
│   │   ├── picking/
│   │   ├── putaway/
│   │   ├── receiving/
│   │   ├── returns/
│   │   ├── shipments/
│   │   ├── tasks/
│   │   ├── settings/
│   │   ├── login/
│   │   └── page.tsx
│   │
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
│
├── components/                    # Shared components
│   ├── Sidebar.tsx               # Navigation sidebar
│   ├── Topbar.tsx                # Top navigation bar
│   └── KpiTile.tsx               # KPI card component
│
├── lib/                          # Utilities
│   └── api.ts                    # API functions
│
├── public/                       # Static assets
│   └── assets/
│       └── avatars/              # User avatars
│
└── Configuration files
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.mjs
    └── postcss.config.js
```

---

## 🎯 Route Structure

### **Admin Routes** (`/admin/*`)

| Route                     | Description           | Features                          |
| ------------------------- | --------------------- | --------------------------------- |
| `/admin`                  | Admin home page       | Quick links to all admin sections |
| `/admin/login`            | Admin login           | Authentication page               |
| `/admin/dashboard`        | Admin dashboard       | KPIs, charts, quick actions       |
| `/admin/warehouses`       | Warehouse management  | View, manage warehouses           |
| `/admin/orders`           | Order management      | View, create, manage orders       |
| `/admin/orders/create`    | Create order          | Order creation form               |
| `/admin/shipments`        | Shipment management   | View, create shipments            |
| `/admin/shipments/create` | Create shipment       | Shipment creation form            |
| `/admin/inventory`        | Inventory management  | View, manage inventory items      |
| `/admin/inventory/create` | Create inventory item | Add new inventory                 |
| `/admin/customers`        | Customer management   | View, manage customers            |
| `/admin/customers/create` | Create customer       | Add new customer                  |
| `/admin/returns`          | Returns management    | Approve, process returns          |
| `/admin/reports`          | Reports & exports     | View, generate reports            |
| `/admin/reports/custom`   | Custom report builder | Create custom reports             |
| `/admin/system`           | System Administrator  | User access, system maintenance   |
| `/admin/settings`         | User settings         | Account preferences               |
| `/admin/help`             | Help center           | Documentation & support           |

### **Worker Routes** (`/worker/*`)

| Route                 | Description          | Features                |
| --------------------- | -------------------- | ----------------------- |
| `/worker`             | Worker home page     | Worker dashboard        |
| `/worker/login`       | Worker login         | Authentication          |
| `/worker/tasks`       | Task list            | View assigned tasks     |
| `/worker/tasks/[id]`  | Task detail          | Individual task view    |
| `/worker/picking`     | Picking operations   | Process picking tasks   |
| `/worker/putaway`     | Putaway operations   | Process putaway tasks   |
| `/worker/receiving`   | Receiving operations | Process receiving tasks |
| `/worker/shipments`   | Shipment processing  | Process shipments       |
| `/worker/returns`     | Returns processing   | Process returns         |
| `/worker/cycle-count` | Cycle counting       | Inventory counting      |
| `/worker/profile`     | Worker profile       | Personal information    |
| `/worker/settings`    | Worker settings      | Preferences             |

---

## 🧩 Key Components

### **Layout Components**

1. **Root Layout** (`app/layout.tsx`)

   - Global HTML structure
   - Material Symbols font
   - Theme configuration

2. **Admin Layout** (`app/(admin)/layout.tsx`)

   - Sidebar navigation (hidden on `/admin/system`)
   - Topbar with search (search hidden on `/admin/system`)
   - Main content area

3. **Worker Layout** (`app/(worker)/layout.tsx`)
   - Worker-specific navigation
   - Mobile-responsive design

### **Shared Components**

1. **Sidebar** (`components/Sidebar.tsx`)

   - Navigation menu for admin
   - Active route highlighting
   - Material icons

2. **Topbar** (`components/Topbar.tsx`)

   - Search functionality
   - Notifications
   - Calendar widget
   - Theme toggle
   - User profile dropdown
   - Conditionally hides search on system page

3. **KpiTile** (`components/KpiTile.tsx`)
   - Reusable KPI card component
   - Used in dashboards

---

## 🎨 Design System

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + DaisyUI
- **Icons**: Material Symbols Outlined
- **Charts**: Recharts
- **Theme**: Custom "optiwms" theme with dark mode support

---

## 🔐 Role-Based Access

### **Administrator Role**

- Full access to all admin pages
- Can manage:
  - Warehouses
  - Orders & Shipments
  - Inventory
  - Customers
  - Returns
  - Reports
  - System configuration (System Admin only)

### **Worker Role**

- Access to operational tasks
- Can perform:
  - Picking
  - Putaway
  - Receiving
  - Shipment processing
  - Returns processing
  - Cycle counting
  - View assigned tasks

### **System Administrator Role**

- Special access to `/admin/system`
- Can manage:
  - User access & permissions
  - System configuration
  - System logs
  - System health monitoring

---

## 📊 Key Features by Section

### **Dashboard**

- KPI tiles (metrics)
- Charts and graphs
- Quick action buttons
- Recent activity

### **Warehouse Management**

- Warehouse listing
- Capacity & utilization tracking
- Status management
- Search & filtering

### **Order Management**

- Order listing with tabs (All, Pending, Shipped, Delivered)
- Order creation
- Status tracking
- Customer association

### **Inventory Management**

- SKU management
- Location tracking
- Stock levels
- Category filtering
- Low stock alerts

### **Customer Management**

- Customer database
- Order history
- Contact information
- Status tracking

### **Returns Management**

- Return request approval
- Return processing workflow
- Restocking operations
- Status tracking (Pending → Approved → Processing → Completed)

### **Reports**

- Pre-built reports
- Custom report builder
- Export functionality
- Report scheduling

### **System Administration**

- User access management
- Role & permission assignment
- System configuration
- System health monitoring
- System logs viewer

---

## 🔄 Data Flow

1. **API Integration** (`lib/api.ts`)

   - Centralized API functions
   - Warehouse fetching example
   - Ready for backend integration

2. **State Management**
   - React hooks (useState, useEffect)
   - Client-side state for UI
   - Mock data for development

---

## 🚀 Development Notes

- **Routing**: Next.js App Router with route groups
- **Styling**: Utility-first CSS with Tailwind
- **Icons**: Material Symbols (Google Fonts)
- **Responsive**: Mobile-first design
- **Type Safety**: Full TypeScript implementation

---

## 📝 Next Steps / TODO

- [ ] Backend API integration
- [ ] Authentication implementation
- [ ] Real-time updates
- [ ] Warehouse create/edit pages
- [ ] Advanced filtering & sorting
- [ ] Export functionality
- [ ] Print functionality
- [ ] Mobile app (PWA ready)
