# Backend Implementation Plan for OptiWMS

## 📋 Table of Contents
1. [Current Status Review](#current-status-review)
2. [Database Schema Design](#database-schema-design)
3. [API Endpoints Specification](#api-endpoints-specification)
4. [Development Environment Setup](#development-environment-setup)
5. [Data Migration Strategy](#data-migration-strategy)
6. [Frontend-Backend Integration](#frontend-backend-integration)
7. [Implementation Phases](#implementation-phases)

---

## 1. Current Status Review

### ✅ Frontend Completed Features

#### **PWA (Worker App)**
- ✅ Home page with 8 features (4×2 grid)
- ✅ Receiving, Putaway, Picking, Cycle Count
- ✅ Stock Transfer (with Location Picker)
- ✅ Packing (with order verification)
- ✅ Shipments, Returns
- ✅ Offline-first architecture (IndexedDB)
- ✅ QR Scanner integration
- ✅ Network status monitoring
- ✅ Profile & Settings pages

#### **Admin Dashboard**
- ✅ Dashboard with KPIs
- ✅ Warehouse Management
- ✅ Orders (Inbound/Outbound)
- ✅ Inventory Management
- ✅ Products Management
- ✅ Suppliers Management
- ✅ Workers Management
- ✅ Tasks Management
- ✅ Cycle Counts
- ✅ Stock Transfers
- ✅ Packing Management
- ✅ Shipments
- ✅ Returns
- ✅ Delivery Partners
- ✅ Customers
- ✅ Reports
- ✅ Quality Checks
- ✅ Anomalies

### ⚠️ Current Issues
- All data is **mock/hardcoded**
- No real API integration
- No database connection
- CSV data not imported
- Backend exists but incomplete

---

## 2. Database Schema Design

### 2.1 Core Entities from CSV Analysis

#### **Materials/Products** (from `Item code and descriptions.csv`)
```sql
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    unit_type VARCHAR(20), -- Bags, Drum, Reel, Can, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Inventory/Stock** (from `Active stock.csv`)
```sql
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50), -- A-01-01-4-A format
    quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    available_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    buffer_stock DECIMAL(15,2),
    max_stock DECIMAL(15,2),
    min_stock DECIMAL(15,2),
    reorder_point DECIMAL(15,2),
    stacking_quantity INTEGER,
    moq DECIMAL(15,2), -- Minimum Order Quantity
    lead_time_days INTEGER,
    last_counted_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, low_stock, out_of_stock, non_moving
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Stock Movements** (from supply plan data)
```sql
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50),
    movement_type VARCHAR(20), -- receipt, putaway, picking, transfer_out, transfer_in, adjustment
    quantity DECIMAL(15,2) NOT NULL,
    reference_type VARCHAR(50), -- order, transfer, cycle_count, etc.
    reference_id UUID,
    user_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **Non-Moving Items** (from `Non Moving items.csv`)
```sql
-- Add status field to inventory table or create separate tracking
CREATE TABLE non_moving_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    last_movement_date DATE,
    days_since_last_movement INTEGER,
    flagged_at TIMESTAMP DEFAULT NOW()
);
```

#### **Raw Materials** (from `Raw matrilas not store in pallets.csv`)
```sql
-- Add flag to materials table
ALTER TABLE materials ADD COLUMN storage_type VARCHAR(20) DEFAULT 'pallet'; 
-- Values: 'pallet', 'bulk', 'loose'
```

### 2.2 Complete Database Schema

#### **Warehouses**
```sql
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Sri Lanka',
    contact_person VARCHAR(200),
    phone VARCHAR(50),
    email VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Locations** (Hierarchical: Area-Row-Bay-Level-Bin)
```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50) UNIQUE NOT NULL, -- A-01-01-4-A
    area VARCHAR(10) NOT NULL, -- A, B, C, D, R
    row_number VARCHAR(10) NOT NULL, -- 01, 02, etc.
    bay_number VARCHAR(10) NOT NULL, -- 01, 02, etc.
    level_number INTEGER NOT NULL, -- 1-4
    bin_position VARCHAR(10) NOT NULL, -- A, B, C
    location_type VARCHAR(50), -- storage, picking, transit, quarantine
    capacity DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    qr_code TEXT, -- Base64 encoded QR code
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_location_code ON locations(location_code);
CREATE INDEX idx_warehouse_location ON locations(warehouse_id, area, row_number, bay_number);
```

#### **Users & Workers**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) UNIQUE, -- EMP-2045
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL, -- admin, supervisor, worker
    warehouse_id UUID REFERENCES warehouses(id),
    phone VARCHAR(50),
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'active',
    device_id VARCHAR(100),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Orders**
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL, -- inbound, outbound
    customer_id UUID REFERENCES customers(id),
    supplier_id UUID REFERENCES suppliers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    status VARCHAR(50) NOT NULL, -- pending, received, picking, packed, shipped, delivered
    priority VARCHAR(20) DEFAULT 'normal', -- normal, express, urgent
    order_date DATE NOT NULL,
    expected_date DATE,
    total_amount DECIMAL(15,2),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id),
    quantity DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2),
    picked_quantity DECIMAL(15,2) DEFAULT 0,
    packed_quantity DECIMAL(15,2) DEFAULT 0,
    location_code VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **Stock Transfers**
```sql
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    transfer_type VARCHAR(20) NOT NULL, -- intra_warehouse, inter_warehouse
    material_id UUID REFERENCES materials(id),
    source_warehouse_id UUID REFERENCES warehouses(id),
    source_location_code VARCHAR(50),
    dest_warehouse_id UUID REFERENCES warehouses(id),
    dest_location_code VARCHAR(50),
    quantity DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- draft, in_transit, received, cancelled
    notes TEXT,
    dispatched_by UUID REFERENCES users(id),
    dispatched_at TIMESTAMP,
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Packing Records**
```sql
CREATE TABLE packing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    order_number VARCHAR(50),
    packaging_type_id UUID REFERENCES packaging_types(id),
    box_type VARCHAR(50),
    box_dimensions JSONB, -- {length, width, height}
    dunnage_materials JSONB, -- ['bubble_wrap', 'air_pillows']
    has_fragile_items BOOLEAN DEFAULT FALSE,
    actual_weight_kg DECIMAL(10,3),
    dimensional_weight_kg DECIMAL(10,3),
    chargeable_weight_kg DECIMAL(10,3),
    tracking_number VARCHAR(100),
    shipping_label_url TEXT,
    packing_slip_url TEXT,
    packing_notes TEXT,
    packing_photos JSONB,
    packer_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, cancelled
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE packaging_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- box, mailer, crate
    length_cm DECIMAL(10,2),
    width_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    max_weight_kg DECIMAL(10,2),
    cost DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **Tasks**
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number VARCHAR(50) UNIQUE NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- receiving, putaway, picking, cycle_count, stock_transfer
    warehouse_id UUID REFERENCES warehouses(id),
    assigned_to UUID REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    location_code VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Cycle Counts**
```sql
CREATE TABLE cycle_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50),
    scheduled_date DATE,
    assigned_workers UUID[], -- Array of user IDs
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    counted_by UUID REFERENCES users(id),
    counted_at TIMESTAMP,
    variance DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Additional Tables**
```sql
-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Sri Lanka',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    lead_time_days INTEGER,
    rating DECIMAL(3,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    destination TEXT,
    weight_kg DECIMAL(10,2),
    driver_name VARCHAR(200),
    driver_phone VARCHAR(50),
    vehicle_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'label_created',
    eta DATE,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Returns
CREATE TABLE returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(50) UNIQUE NOT NULL,
    original_order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    return_date DATE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    resolution VARCHAR(50),
    received_by UUID REFERENCES users(id),
    inspected_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. API Endpoints Specification

### 3.1 Authentication & Authorization
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### 3.2 Master Data APIs

#### **Warehouses**
```
GET    /api/master/warehouses
GET    /api/master/warehouses/:id
POST   /api/master/warehouses
PUT    /api/master/warehouses/:id
DELETE /api/master/warehouses/:id
```

#### **Materials/Products**
```
GET    /api/master/materials
GET    /api/master/materials/:id
GET    /api/master/materials/search?q=:query
POST   /api/master/materials
PUT    /api/master/materials/:id
DELETE /api/master/materials/:id
POST   /api/master/materials/import (CSV upload)
GET    /api/master/materials/template (download CSV template)
```

#### **Locations**
```
GET    /api/master/locations
GET    /api/master/locations/:code
GET    /api/master/locations/search?q=:query
POST   /api/master/locations
PUT    /api/master/locations/:code
GET    /api/master/locations/:code/qr-code (generate QR)
```

#### **Inventory**
```
GET    /api/inventory
GET    /api/inventory/:materialId
GET    /api/inventory/location/:locationCode
GET    /api/inventory/warehouse/:warehouseId
POST   /api/inventory/adjust
GET    /api/inventory/non-moving
GET    /api/inventory/low-stock
```

### 3.3 Order Management APIs

#### **Orders**
```
GET    /api/orders
GET    /api/orders/:id
GET    /api/orders/inbound
GET    /api/orders/outbound
POST   /api/orders
PUT    /api/orders/:id
DELETE /api/orders/:id
GET    /api/orders/:id/items
POST   /api/orders/:id/items
```

### 3.4 Warehouse Operations APIs

#### **Receiving**
```
GET    /api/receiving/pending
POST   /api/receiving/start
POST   /api/receiving/:id/scan-item
POST   /api/receiving/:id/complete
```

#### **Putaway**
```
GET    /api/putaway/pending
POST   /api/putaway/start
POST   /api/putaway/:id/assign-location
POST   /api/putaway/:id/complete
```

#### **Picking**
```
GET    /api/picking/pending
GET    /api/picking/orders/:orderId
POST   /api/picking/start
POST   /api/picking/:id/scan-item
POST   /api/picking/:id/complete
```

#### **Packing**
```
GET    /api/packing/orders/ready
GET    /api/packing/orders/:orderId
POST   /api/packing/orders/:orderId/start
POST   /api/packing/orders/:orderId/verify-item
GET    /api/packing/box-suggestions/:orderId
POST   /api/packing/orders/:orderId/complete
POST   /api/packing/orders/:orderId/print-label
POST   /api/packing/orders/:orderId/print-slip
GET    /api/packing/packaging-types
```

#### **Stock Transfers**
```
GET    /api/stock-transfers
GET    /api/stock-transfers/:id
POST   /api/stock-transfers
POST   /api/stock-transfers/:id/dispatch
POST   /api/stock-transfers/:id/receive
GET    /api/stock-transfers/pending-receipts
DELETE /api/stock-transfers/:id/cancel
```

#### **Cycle Counts**
```
GET    /api/cycle-counts
GET    /api/cycle-counts/:id
POST   /api/cycle-counts
PUT    /api/cycle-counts/:id
POST   /api/cycle-counts/:id/start
POST   /api/cycle-counts/:id/scan
POST   /api/cycle-counts/:id/complete
DELETE /api/cycle-counts/:id/cancel
```

### 3.5 Shipment & Returns APIs

#### **Shipments**
```
GET    /api/shipments
GET    /api/shipments/:id
POST   /api/shipments
POST   /api/shipments/:id/process
POST   /api/shipments/:id/print-manifest
GET    /api/shipments/:id/track
```

#### **Returns**
```
GET    /api/returns
GET    /api/returns/:id
POST   /api/returns
POST   /api/returns/:id/process
POST   /api/returns/:id/inspect
POST   /api/returns/:id/resolve
```

### 3.6 Task Management APIs
```
GET    /api/tasks
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
POST   /api/tasks/:id/assign
POST   /api/tasks/:id/complete
```

### 3.7 User & Worker APIs
```
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
GET    /api/users/:id/profile
PUT    /api/users/:id/profile
```

### 3.8 Dashboard & Reports APIs
```
GET    /api/dashboard/kpis
GET    /api/dashboard/recent-activities
GET    /api/reports
GET    /api/reports/:id/download
POST   /api/reports/schedule
POST   /api/reports/custom
```

---

## 4. Development Environment Setup

### 4.1 Docker Setup (Recommended for Cross-Platform)

#### **docker-compose.yml** (Update existing)
```yaml
version: "3.9"

services:
  db:
    image: postgres:16
    container_name: optiwms-db
    environment:
      POSTGRES_DB: optiwms
      POSTGRES_USER: optiwms
      POSTGRES_PASSWORD: optiwms
    ports:
      - "5434:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U optiwms"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: optiwms-backend
    depends_on:
      db:
        condition: service_healthy
    environment:
      SPRING_PROFILES_ACTIVE: docker
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/optiwms
      SPRING_DATASOURCE_USERNAME: optiwms
      SPRING_DATASOURCE_PASSWORD: optiwms
      JAVA_OPTS: "-Xmx512m"
    ports:
      - "8080:8080"
    volumes:
      - ./backend:/app
      - backend_build:/app/build
    command: ./gradlew bootRun

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: optiwms-frontend
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next

volumes:
  db_data:
  backend_build:
```

#### **backend/Dockerfile**
```dockerfile
FROM gradle:8.5-jdk21 AS builder
WORKDIR /app
COPY . .
RUN ./gradlew build -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/core-api/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### **frontend/Dockerfile**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "start"]
```

### 4.2 Gradle Wrapper Setup

#### **Create gradle wrapper** (Run in backend directory)
```bash
cd backend
gradle wrapper --gradle-version 8.5 --distribution-type all
```

This creates:
- `gradlew` / `gradlew.bat` (wrapper scripts)
- `gradle/wrapper/gradle-wrapper.jar`
- `gradle/wrapper/gradle-wrapper.properties`

#### **Update .gitignore** (if needed)
```
backend/.gradle/
backend/build/
!backend/gradle/wrapper/
```

### 4.3 Local Development (Without Docker)

#### **Prerequisites**
- JDK 21 or 25 (both supported via Gradle)
- PostgreSQL 16
- Node.js 20+

#### **Backend Setup**
```bash
cd backend
./gradlew build
./gradlew bootRun
```

#### **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

### 4.4 Environment Variables

#### **backend/src/main/resources/application.yml**
```yaml
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:local}
  datasource:
    url: ${DATASOURCE_URL:jdbc:postgresql://localhost:5434/optiwms}
    username: ${DATASOURCE_USERNAME:optiwms}
    password: ${DATASOURCE_PASSWORD:optiwms}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 8080
  cors:
    allowed-origins: http://localhost:3000
    allowed-methods: GET,POST,PUT,DELETE,OPTIONS
    allowed-headers: "*"
```

---

## 5. Data Migration Strategy

### 5.1 CSV Import Script

Create `backend/integration/src/main/java/com/optiwms/integration/CsvDataImporter.java`

#### **Import Materials**
```java
@Service
public class CsvDataImporter {
    
    @Autowired
    private MaterialRepository materialRepository;
    
    @Autowired
    private InventoryRepository inventoryRepository;
    
    public void importMaterials(String csvPath) {
        // Parse Item code and descriptions.csv
        // Create Material entities
        // Save to database
    }
    
    public void importInventory(String csvPath) {
        // Parse Active stock.csv
        // Link to materials by material_code
        // Create Inventory records
    }
    
    public void flagNonMovingItems(String csvPath) {
        // Parse Non Moving items.csv
        // Update inventory status
    }
}
```

### 5.2 Synthetic Data Generation

#### **Sri Lanka-Specific Data**
- **Cities**: Colombo, Kandy, Galle, Jaffna, Negombo, Kurunegala
- **Postal Codes**: 00100-99999 format
- **Phone Numbers**: +94-XX-XXXXXXX format
- **Addresses**: Sri Lankan address format
- **Names**: Sinhala/Tamil/English names

#### **Generate Script**
```java
@Service
public class SyntheticDataGenerator {
    
    public void generateCustomers(int count) {
        // Generate customers with Sri Lankan data
    }
    
    public void generateSuppliers(int count) {
        // Generate suppliers
    }
    
    public void generateOrders(int count) {
        // Generate orders linked to real materials
    }
}
```

---

## 6. Frontend-Backend Integration

### 6.1 API Client Setup

#### **Update frontend/lib/api.ts**
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Materials
  async getMaterials() {
    return this.request("/api/master/materials");
  }

  async getMaterial(id: string) {
    return this.request(`/api/master/materials/${id}`);
  }

  // Inventory
  async getInventory() {
    return this.request("/api/inventory");
  }

  // Orders
  async getOrders() {
    return this.request("/api/orders");
  }

  // ... Add all other endpoints
}

export const apiClient = new ApiClient(API_BASE);
```

### 6.2 Replace Mock Data

#### **Example: Products Page**
```typescript
// Before (mock data)
const products = [...mockProducts];

// After (API call)
const [products, setProducts] = useState([]);
useEffect(() => {
  apiClient.getMaterials().then(setProducts);
}, []);
```

### 6.3 Error Handling & Loading States
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  apiClient.getMaterials()
    .then(setProducts)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

---

## 7. Implementation Phases

### **Phase 1: Infrastructure Setup** (Week 1)
- [ ] Set up Gradle wrapper
- [ ] Configure Docker Compose
- [ ] Create database schema (Flyway migrations)
- [ ] Set up basic Spring Boot structure
- [ ] Configure CORS for frontend

### **Phase 2: Data Import** (Week 1-2)
- [ ] Create CSV import service
- [ ] Import materials from CSV
- [ ] Import inventory data
- [ ] Generate synthetic data (customers, suppliers, orders)
- [ ] Seed initial users and warehouses

### **Phase 3: Core APIs** (Week 2-3)
- [ ] Authentication API
- [ ] Master data APIs (materials, warehouses, locations)
- [ ] Inventory APIs
- [ ] Order management APIs

### **Phase 4: Warehouse Operations** (Week 3-4)
- [ ] Receiving API
- [ ] Putaway API
- [ ] Picking API
- [ ] Packing API
- [ ] Stock Transfer API
- [ ] Cycle Count API

### **Phase 5: Frontend Integration** (Week 4-5)
- [ ] Replace mock data in admin dashboard
- [ ] Replace mock data in PWA
- [ ] Implement API client
- [ ] Add error handling
- [ ] Add loading states

### **Phase 6: Testing & Optimization** (Week 5-6)
- [ ] Integration testing
- [ ] Performance optimization
- [ ] Security review
- [ ] Documentation

---

## 8. Quick Start Commands

### **Using Docker (Recommended)**
```bash
# Start all services
cd infra
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### **Local Development**
```bash
# Start database
docker-compose -f infra/docker-compose.yml up db -d

# Start backend
cd backend
./gradlew bootRun

# Start frontend
cd frontend
npm run dev
```

---

## 9. Next Steps

1. **Review this plan** with the team
2. **Set up Docker environment** for cross-platform development
3. **Create database migrations** using Flyway
4. **Implement CSV import service**
5. **Start with Phase 1** implementation

---

**Last Updated**: 2025-01-XX
**Status**: Planning Phase

