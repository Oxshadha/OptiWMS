# OptiWMS

Monorepo for a Warehouse Management System (WMS) with AI-ready architecture.

## Overview

OptiWMS is a comprehensive Warehouse Management System designed to optimize warehouse operations through intelligent automation, real-time tracking, and AI-powered decision making.

## Structure

- `backend/` – Java Spring Boot, PostgreSQL, domain-driven modules.
- `frontend/` – Next.js (PWA for workers, role-based dashboards for admins/managers).
- `ai-services/` – AI microservices for intelligent warehouse optimization (demand forecasting, inventory optimization, optimal storage suggestions, path optimization, anomaly detection).
- `infra/` – Docker Compose, Kubernetes manifests, CI/CD, database migrations.
- `docs/` – Architecture docs, ERD, ADRs, and this project plan reference.
- `Resources/` – Project resources and documentation (empty in repository).

## Features

### Admin Dashboard
- Warehouse management and monitoring
- Order processing and tracking
- Inventory management
- Customer management
- Reports and analytics
- Settings and configuration

### Worker PWA
- Mobile-optimized Progressive Web App with offline-first architecture
- Task management (receiving, putaway, picking, cycle count)
- Shipment processing
- Returns handling
- Real-time notifications
- **Offline-First Architecture**:
  - Works seamlessly with or without network connectivity
  - IndexedDB for persistent local data storage
  - Data persists even when app is closed or killed
  - Automatic sync when network connection is restored
- **Optimal Path Routing**:
  - AI-powered optimal path calculation for picking and packing operations
  - Path loaded into frontend (works offline once loaded)
  - QR code scanning at each location with path tracking
  - Progress saved locally and synced when online

### AI-Powered Microservices
- **Demand Forecasting**:
  - Predictive analytics for inventory demand
  - Historical data analysis and trend prediction
  - Seasonal pattern recognition
  - Multi-factor demand modeling
- **Inventory Optimization**:
  - Optimal stock level recommendations
  - Reorder point calculations
  - Safety stock optimization
  - ABC/XYZ analysis for inventory classification
- **Optimal Storage Suggestions**:
  - AI-driven slotting recommendations
  - Location assignment based on velocity, size, and compatibility
  - Space utilization optimization
  - Dynamic storage reallocation
- **Optimal Path Suggesting**:
  - Intelligent route optimization for picking/packing
  - Multi-objective path planning (time, distance, efficiency)
  - Real-time path recalculation
  - Worker-specific path adaptation
- **Anomaly Detection (Two-Level)**:
  - **Database Level**: Cycle count anomaly detection
    - Automatic discrepancy identification
    - Variance analysis and threshold monitoring
    - Real-time alert generation
  - **AI Clustering Level**: Advanced anomaly detection
    - Machine learning-based pattern recognition
    - Unsupervised clustering for outlier detection
    - Behavioral anomaly identification
    - Predictive anomaly prevention

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, DaisyUI
- **Backend**: Java Spring Boot, PostgreSQL
- **AI Services**: Python microservices (scikit-learn, pandas, TensorFlow/PyTorch for ML models)
- **Infrastructure**: Docker, Kubernetes
- **Offline Storage**: IndexedDB (browser-native persistent storage)
- **PWA**: Service Workers, Web App Manifest, offline-first architecture

## Getting Started

### Quick Start (5 minutes)
See **[QUICK_START.md](./QUICK_START.md)** for the fastest way to get up and running.

### Complete Setup Guide
See **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** for detailed setup instructions, troubleshooting, and cross-platform compatibility.

### Prerequisites
- **Java**: JDK 21 or 25
- **Node.js**: Version 20 or higher
- **Docker Desktop**: For database (recommended)
- **PostgreSQL**: Version 16 (optional if using Docker)
- **Git**: For version control

### Quick Setup Commands

**1. Start Database:**
```bash
cd infra
docker-compose up -d db
```

**2. Start Backend:**
```bash
cd backend
./gradlew :core-api:bootRun
```

**3. Start Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- Health Check: http://localhost:8080/actuator/health

## Documentation

- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute, prevent conflicts, and work as a team
- **[Development Guide](./DEVELOPMENT_GUIDE.md)** - Complete development workflow and best practices
- **[Frontend Structure](./FRONTEND_STRUCTURE.md)** - Frontend architecture, routing, and component guidelines
- **[API Documentation](./API_DOCUMENTATION.md)** - Backend API endpoints and integration guide
- **[Project Plan](./docs/plan.md)** - High-level blueprint and roadmap (local only)

## License

[Add your license here]

## Contributors

[Add contributors here]

