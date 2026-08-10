# OptiWMS - User Roles & Permissions

This document defines the user roles, access control framework, and system permission matrix across both the **Admin Dashboard** and the **Worker Mobile PWA**.

---

## 🏛️ System Interface Separation

OptiWMS splits user interactions across two distinct portals:
1. **Admin Web Portal (`/admin/*`)**: Desktop-optimized dashboard for planning, monitoring, auditing, scheduling, and executing AI optimization workflows.
2. **Worker Mobile PWA (`/worker/*`)**: Mobile-first, barcode scanner-ready Progressive Web Application with offline capabilities for executing floor operations.

---

## 🖥️ 1. Admin Roles & Permissions (Web Portal)

Admin access is controlled by a role-based permission matrix mapping roles to routes with granular operations (`view`, `create`, `edit`, `delete`, `approve`).

### The Admin Personas
1. **System Administrator (`admin`)**: Manages system configurations, integrations, developer setups, user management, and AI services.
2. **Warehouse Manager (`warehouse_manager`)**: Focuses on single-site operations, inventory levels, tasks distribution, labor charts, and approving slotting/replenishment suggestions.
3. **Inbound Coordinator (`inbound_coordinator`)**: Coordinates POs, carriers, yard queues, dock appointments, and supplier returns.

### Detailed Admin Route Matrix
The following table details which routes are accessible and the specific actions allowed per role.

| Route Code & Path | System Administrator | Warehouse Manager | Inbound Coordinator |
| :--- | :--- | :--- | :--- |
| **Dashboard** (`/admin/dashboard`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Warehouses** (`/admin/warehouses`) | View, Create, Edit, Delete, Approve | View | View |
| **Orders (PO/SO)** (`/admin/orders`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Shipments** (`/admin/shipments`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Delivery Partners** (`/admin/delivery-partners`) | View, Create, Edit, Delete, Approve | View, Create, Edit *(No Delete)* | View, Create, Edit |
| **Inventory Ledger** (`/admin/inventory`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Materials/SKU Master** (`/admin/materials`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Suppliers Master** (`/admin/suppliers`) | View, Create, Edit, Delete, Approve | View, Create, Edit, Approve *(No Delete)* | View, Create, Edit, Approve |
| **BOM Master (Bill of Materials)** (`/admin/bom-master`) | View, Create, Edit, Delete, Approve | *No Access* | *No Access* |
| **Worker Profiles** (`/admin/workers`) | View, Create, Edit, Delete, Approve | View *(Read-Only)* | View *(Read-Only)* |
| **Admin Accounts** (`/admin/admins`) | View, Create, Edit, Delete, Approve | *No Access* | *No Access* |
| **Tasks Distribution** (`/admin/tasks`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Cycle Counts Management** (`/admin/cycle-counts`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Stock Transfers** (`/admin/stock-transfers`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **QC Audits** (`/admin/quality-checks`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **Returns Processing** (`/admin/returns`) | View, Create, Edit, Delete, Approve | View, Create, Edit, Approve | View, Create, Edit, Approve |
| **Anomalies Log** (`/admin/anomalies`) | View, Create, Edit, Delete, Approve | View, Create, Edit | View, Create, Edit |
| **AI Replenishment** (`/admin/replenishment`) | View, Create, Edit, Delete, Approve | View, Create, Edit, Approve | View *(Read-Only)* |
| **AI Slotting & Layout** (`/admin/ai-slotting`) | View, Create, Edit, Delete, Approve | View, Create, Edit, Approve | View *(Read-Only)* |
| **Dock & Yard Management** (`/admin/dock-management`) | View, Create, Edit, Delete, Approve | *No Access* | View, Create, Edit *(Primary User)* |
| **Labor Productivity** (`/admin/labor-productivity`) | View, Create, Edit, Delete, Approve | View, Create, Edit *(Primary User)* | View *(Read-Only)* |
| **System Settings** (`/admin/settings`) | View, Create, Edit, Delete, Approve | *No Access* | *No Access* |

---

## 📱 2. Worker Roles & Permissions (Mobile PWA)

Workers authenticate on handheld terminals at `/worker/login` using credentials mapped to their floor specialization. The PWA checks their assigned role to display or hide functional route groups.

### The Worker Personas & Duties
1. **Forklift Operator**: Heavy transport operator. Moves bulk pallets, picks heavy cases, and relocates large stacks across zones.
2. **Stacker Operator**: High-bay operator. Responsible for narrow-aisle putaway and retrieval from high rack levels (Levels 3-5).
3. **Powered Pallet Truck Operator**: Low-level ground transporter. Coordinates staging, dock clearance, and fast ground moves.
4. **Unloading Worker**: Physical container unloading. Empties incoming trailers and stacks items onto staging pallets.
5. **Receiver**: Verifies supplier packing slips, inspects parcel conditions, and logs blind receiving counts.
6. **Putaway Worker**: Moves received goods from staging lanes to slots generated by the putaway engine.
7. **Quality Checker**: Audits material dimensions, checks batch numbers, and routes suspect inventory to quarantine.
8. **Cycle Count Worker**: Conducts scheduled inventory audits and logs physical counts.
9. **Picker**: Picks order items along paths calculated by the A* optimization service.
10. **Packer**: Packs items into boxes, checks package weights, and prints shipping labels.
11. **Shipment Worker**: Loads packages onto carrier trucks and scans shipment tags.
12. **Returns Worker**: Inspects returned goods, logs conditions, and determines routing.
13. **Vehicle Inspector**: Inspects inbound/outbound transport trucks at the security gate.
14. **Warehouse Safekeeping Worker**: Audits high-value storage cages and registers security counts.

### Detailed PWA Permission Matrix
The following table details which functional workflows (matching mobile route paths) are accessible to each worker role.

| Worker Role | Receiving | Putaway | Picking | Cycle Count | Stock Transfer | Packing | Shipments | Returns |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Forklift Operator** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Stacker Operator** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Powered Pallet Truck** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Unloading Worker** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Receiver** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Putaway Worker** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Quality Checker** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Cycle Count Worker** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Picker** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Packer** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Shipment Worker** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Returns Worker** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Vehicle Inspector** | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Safekeeping Worker** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

*Note: The Vehicle Inspector role is limited strictly to receiving-inspection checklists, with no access to actual PO line updates.*
