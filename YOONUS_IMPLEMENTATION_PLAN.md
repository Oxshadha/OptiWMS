# YOONUS M.S.M. (235548G) - Implementation Plan
## OptiWMS - Intelligent Warehouse Management System

**Project Role**: Research, Backend (Auth/Notifications), Logic Implementation (A* Pathfinding), Frontend (Login & Navigation)

---

## 1. Project Overview

OptiWMS is a comprehensive warehouse management system built with:
- **Backend**: Java 21, Spring Boot 3.3, Spring Security, Hibernate JPA
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Database**: PostgreSQL 17
- **AI Services**: Python (FastAPI) microservices for forecasting, path optimization, anomaly detection

**Delivery Status**: Core WMS operational, AI services partially integrated

---

## 2. YOONUS Responsibilities Matrix

### 2.1 **Backend Implementation**

#### A. Identity & Access Management (Auth/Users)
**Components**:
- `SecurityConfig.java` - Spring Security configuration with JWT
- `JwtTokenProvider.java` - JWT token generation and validation  
- `JwtAuthenticationFilter.java` - JWT request filter
- `CustomUserDetailsService.java` - User details loading
- `AuthController.java` - Authentication endpoints
- `UserController.java` - User management endpoints
- `UserService.java` - Enhanced with new operations
- `UserEntity.java` - JPA entity with all fields
- `UserRepository.java` - Data access layer

**Responsibilities**:
✅ JWT token generation and validation  
✅ User login/logout flows  
✅ User role management (Admin, Worker variants)  
✅ Password hashing and security  
✅ Session management and token refresh  
✅ User profile management endpoints  

**Status**: Partially implemented - needs enhancement

---

#### B. Warehouse Alert & Notification System  
**Components**:
- `Notification.java` / `NotificationEntity.java` - Domain model
- `NotificationService.java` - Business logic
- `NotificationController.java` - REST API endpoints
- `NotificationRepository.java` - Data access
- `AlertType.java` - Enum for alert categories
- `AlertSeverity.java` - Severity levels

**Alert Types Supported**:
- Low stock warnings
- Slow-moving item alerts
- Conges tion alerts (from pathfinding)
- Picking route optimization suggestions
- System health alerts
- Order fulfillment status changes

**Responsibilities**:
✅ Create and store notifications  
✅ Retrieve notifications by user/type/date  
✅ Mark notifications as read/actioned  
✅ Real-time notification delivery (WebSocket optional)  
✅ Notification preferences per user  
✅ Bulk notification operations  

**Status**: Partially implemented - needs enhancement

---

### 2.2 **AI Services - Path Optimization**

#### A* Pathfinding Algorithm Implementation
**Components**:
- `AStarPathfinder.java` - Core A* algorithm
- `PathNode.java` - Graph node representation
- `WarehouseGraph.java` - Warehouse layout as graph
- `PathfindingService.java` - Service layer logic
- `PathfindingController.java` - REST API
- `PathfindingDTO.java` - Data transfer objects
- `PathfindingRequest.java` - Request model
- `PathfindingResponse.java` - Response model

**Responsibilities**:
✅ Implement A* search algorithm  
✅ Build warehouse graph from location data  
✅ Handle dynamic obstacles (blocked aisles)  
✅ Support multiple heuristics (Manhattan, Euclidean)  
✅ Calculate travel time estimates  
✅ Return optimized picking routes with instructions  
✅ Performance optimization (<5ms per request)  

**Status**: Partially implemented - needs real warehouse integration

---

### 2.3 **Frontend Implementation**

#### A. Admin Login Interface
**Components**:
- `frontend/app/admin/login/page.tsx` - Login page
- `AdminLoginForm.tsx` - Form component
- `WarehouseSelector.tsx` - Warehouse selection dropdown
- `LoginStyles.module.css` - Styling

**Responsibilities**:
✅ Email/password input fields  
✅ Warehouse selection dropdown  
✅ Remember me functionality  
✅ Error message display  
✅ Loading states and validation  
✅ Redirect after successful login  
✅ Link to password recovery  

**Status**: Partially implemented - needs complete styling

---

#### B. Worker Login Interface
**Components**:
- `frontend/app/worker/login/page.tsx` - Login page
- `WorkerLoginForm.tsx` - Form component
- `RoleSelector.tsx` - Worker role selector
- `WorkerLoginStyles.module.css` - Styling

**Responsibilities**:
✅ Employee ID input (instead of email)  
✅ Password input with visibility toggle  
✅ Worker role selection (Picker, Packer, Receiver, etc.)  
✅ Mobile-responsive design (PWA)  
✅ Visual feedback and error handling  
✅ Warehouse context selection  
✅ Device/session management  

**Status**: Partially implemented - needs enhancement

---

#### C. Global Navigation (Topbar)
**Components**:
- `components/Topbar.tsx` - Main navigation bar
- `components/ProfileMenu.tsx` - User profile dropdown
- `components/NotificationBell.tsx` - Notification center
- `components/UserMenu.tsx` - Logout and settings menu

**Responsibilities**:
✅ Display user name and role  
✅ Notification center with bell icon  
✅ User profile dropdown menu  
✅ Logout functionality  
✅ Role-based navigation visibility  
✅ Real-time notification display  
✅ Dark/light theme toggle  
✅ Search functionality  
✅ Quick links based on role  

**Status**: Partially implemented - needs notification integration

---

#### D. Real-time Picking Route Integration
**Components**:
- `components/PickingRouteGuide.tsx` - Route visualization
- `components/PathVisualizerNew.tsx` - Interactive path display
- `components/ControlPanelNew.tsx` - Route controls
- `components/WarehouseVisualizationNew.tsx` - Map display
- `pages/picking/page.tsx` - Picking workflow page

**Responsibilities**:
✅ Display optimized picking routes  
✅ Real-time location tracking visualization  
✅ Turn-by-turn navigation instructions  
✅ Allow picking confirmation per item  
✅ Show estimated travel time  
✅ Support rerouting when paths blocked  
✅ Integration with order details  
✅ Performance metrics (time saved, efficiency)  

**Status**: Partially implemented - needs API integration

---

## 3. Architecture Decisions

### 3.1 Authentication Flow

```
Browser                    Backend           Database
  │                          │                   │
  ├─ POST /api/auth/login    │                   │
  │────────────────────────→ │                   │
  │                          ├─ Verify User      │
  │                          │──────────────────→│
  │                          │←─ User Record ────│
  │                          │                   │
  │                          ├─ Hash Password    │
  │                          ├─ Generate JWT     │
  │  ← JWT Token ────────────│                   │
  │                                              │
  ├─ GET /api/users/profile                     │
  ├─ Authorization: Bearer {JWT}                │
  │────────────────────────→ │                   │
  │                          ├─ Validate JWT     │
  │                          ├─ Get User Data    │
  │                          │──────────────────→│
  │  ← User Profile ─────────│                   │
```

**Key Points**:
- JWT stored in localStorage (frontend)
- Token includes: user ID, role, warehouse ID, issued time, expiry
- Refresh tokens for extending sessions
- CORS configured for frontend origin
- Rate limiting on auth endpoints

---

### 3.2 A* Pathfinding Algorithm

```
Input: Start Location, End Location, Blocked Nodes
   │
   ├─ Build Warehouse Graph
   │  └─ Load from Location master data
   │
   ├─ Initialize A* Search
   │  ├─ Open Set = {Start Node}
   │  ├─ Closed Set = {}
   │  └─ Cost Scores = {start: 0}
   │
   ├─ While Open Set not empty:
   │  │
   │  ├─ Current = Node with lowest f-score
   │  │
   │  ├─ If Current == Goal:
   │  │  └─ Return Path (reconstruct from came_from)
   │  │
   │  ├─ For Each Neighbor:
   │  │  ├─ If Neighbor in Closed Set: skip
   │  │  ├─ If Neighbor blocked: skip
   │  │  ├─ Calculate new g-score
   │  │  ├─ If new g-score < recorded g-score:
   │  │  │  ├─ Update costs
   │  │  │  └─ Add to Open Set
   │  │  │
   │  │  └─ Move Current to Closed Set
   │  │
   │  └─ Return Empty Path (no solution found)
   │
   └─ Output: Path (list of nodes), TravelTime, Instructions
```

**Heuristic Functions**:
- **Manhattan Distance**: |x1-x2| + |y1-y2|  
- **Euclidean Distance**: √((x1-x2)² + (y1-y2)²)  
- **Graph-based**: Adjusted for actual warehouse layout

---

### 3.3 Notification System

```
Event Source          Service           Storage         Consumer
   │                    │                  │               │
   ├ Low Stock Alert    │                  │               │
   ├─────────────────→ Notification ───────→ PostgreSQL    │
   │                   Service              │               │
   ├ Picking Alert      │             Store with:           │
   ├─────────────────→  │             ├─ User ID            │
   │                    │             ├─ Type               │
   ├ Congestion         │             ├─ Severity           │
   ├─────────────────→  │             ├─ Timestamp          │
   │                    │             └─ Read Status        │
   │                    │                  │               │
   │                    │                  │       GET /api/notifications
   │                    │                  │       ←─────────────────
   │                    │                  │       Return JSON
   └ System Health      │                  └───────────────→│
      ─────────────────→│                                   │
                                                       Frontend Display
```

---

## 4. Implementation Checklist

### Phase 1: Backend Authentication & Authorization

- [ ] Enhance `SecurityConfig.java` with advanced features
- [ ] Implement `JwtTokenProvider.java` with refresh token logic
- [ ] Create `JwtAuthenticationFilter.java` for request signing
- [ ] Develop `CustomUserDetailsService.java` with complete user loading
- [ ] Create `AuthController.java` with login/logout/refresh endpoints
- [ ] Enhance `UserService.java` with role management
- [ ] Implement password reset functionality
- [ ] Add role-based access control (RBAC) decorators
- [ ] Unit tests for auth components

### Phase 2: Notification System

- [ ] Create `Notification.java` domain model
- [ ] Create `NotificationEntity.java` JPA entity
- [ ] Create `NotificationRepository.java` data access
- [ ] Implement `NotificationService.java` with CRUD operations
- [ ] Create `NotificationController.java` REST endpoints
- [ ] Implement notification types and severity levels
- [ ] Add notification preferences per user
- [ ] Add bulk operations (mark as read, delete)
- [ ] Unit tests for notification components

### Phase 3: A* Pathfinding

- [ ] Implement `AStarPathfinder.java` algorithm
- [ ] Create `PathNode.java` comparable node class
- [ ] Build `WarehouseGraph.java` from location data
- [ ] Implement `PathfindingService.java`
- [ ] Create `PathfindingController.java` REST API
- [ ] Add multiple heuristic support
- [ ] Performance optimization and testing
- [ ] Integration with actual warehouse data
- [ ] Unit and integration tests

### Phase 4: Frontend - Login Interfaces

- [ ] Complete `admin/login/page.tsx` styling and functionality
- [ ] Complete `worker/login/page.tsx` mobile-responsive design
- [ ] Create warehouse selector component
- [ ] Add form validation and error handling
- [ ] Implement password visibility toggle
- [ ] Add "Remember Me" functionality
- [ ] Password reset flow
- [ ] Session management UI

### Phase 5: Frontend - Navigation & Routes

- [ ] Enhance `Topbar.tsx` with full functionality
- [ ] Create `ProfileMenu.tsx` dropdown
- [ ] Create `NotificationBell.tsx` with real-time updates
- [ ] Implement theme switcher (dark/light)
- [ ] Add role-based navigation items
- [ ] Search functionality across system
- [ ] Notification center with filtering
- [ ] Responsive design for mobile/tablet

### Phase 6: Frontend - Picking Integration

- [ ] Create `PickingRouteGuide.tsx` component
- [ ] Enhance `PathVisualizerNew.tsx` for picking flow
- [ ] Implement `ControlPanelNew.tsx` with route controls
- [ ] Add real-time location tracking visualization
- [ ] Create turn-by-turn instructions
- [ ] Add item confirmation UI
- [ ] Estimate travel time display
- [ ] Rerouting support when paths blocked
- [ ] Performance metrics dashboard

### Phase 7: Testing & Documentation

- [ ] Unit tests for all services
- [ ] Integration tests for API endpoints
- [ ] Frontend component tests
- [ ] End-to-end testing scenarios
- [ ] Security testing (auth, injection, etc.)
- [ ] Load testing for pathfinding service
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User documentation
- [ ] Technical architecture documentation

---

## 5. API Endpoints

### 5.1 Authentication Endpoints

```
POST   /api/auth/login          - User login
POST   /api/auth/logout         - User logout
POST   /api/auth/refresh-token  - Refresh JWT token
POST   /api/auth/validate-token - Validate token
POST   /api/auth/forgot-password - Password reset request
POST   /api/auth/reset-password - Reset password with token
```

### 5.2 User Management Endpoints

```
GET    /api/users               - List all users (admin only)
GET    /api/users/{id}          - Get user details
GET    /api/users/profile/me    - Get current user profile
POST   /api/users               - Create new user (admin)
PUT    /api/users/{id}          - Update user (admin or self)
DELETE /api/users/{id}          - Delete user (admin)
GET    /api/users/role/{role}   - List users by role
PATCH  /api/users/{id}/password - Change password
```

### 5.3 Notification Endpoints

```
GET    /api/notifications              - List user notifications
GET    /api/notifications/unread       - Get unread count
GET    /api/notifications/{id}         - Get notification details
PUT    /api/notifications/{id}/read    - Mark as read
PUT    /api/notifications/read-all     - Mark all as read
DELETE /api/notifications/{id}         - Delete notification
DELETE /api/notifications/delete-all   - Delete all notifications
POST   /api/notifications/preferences  - Update preferences
```

### 5.4 Pathfinding Endpoints

```
POST   /api/pathfinding/find-path    - Find optimal picking route
POST   /api/pathfinding/batch-optimize - Optimize multiple orders
GET    /api/pathfinding/warehouse-info - Get warehouse graph data
POST   /api/pathfinding/validate-route - Validate if route is valid
GET    /api/pathfinding/health        - Service health check
```

---

## 6. Data Models

### 6.1 User Entity

```java
@Entity
@Table(name = "users")
public class UserEntity {
    @Id
    @GeneratedValue
    private UUID id;
    
    @Column(unique = true, nullable = false)
    private String username;
    
    @Column(unique = true)
    private String email;
    
    @Column(nullable = false)
    private String passwordHash;
    
    @Column(unique = true)
    private String employeeId;
    
    private String firstName;
    private String lastName;
    
    @Enumerated(EnumType.STRING)
    private UserRole role;  // ADMIN, WAREHOUSE_MANAGER, PICKER, etc.
    
    @Column(name = "warehouse_id")
    private UUID warehouseId;
    
    private String phone;
    private String avatarUrl;
    
    @Enumerated(EnumType.STRING)
    private UserStatus status;  // ACTIVE, INACTIVE, SUSPENDED
    
    private String deviceId;
    private Boolean blindReceivingMode;
    
    @Convert(converter = JsonConverter.class)
    private Map<String, Object> dashboardSettings;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;
}
```

### 6.2 Notification Entity

```java
@Entity
@Table(name = "notifications")
public class NotificationEntity {
    @Id
    @GeneratedValue
    private UUID id;
    
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    
    @Enumerated(EnumType.STRING)
    private AlertType type;  // LOW_STOCK, CONGESTION, ORDER_READY, etc.
    
    @Enumerated(EnumType.STRING)
    private AlertSeverity severity;  // INFO, WARNING, CRITICAL
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String message;
    
    @Column(columnDefinition = "jsonb")
    private String metadata;  // JSON for additional context
    
    private Boolean isRead;
    private Boolean isActioned;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "read_at")
    private LocalDateTime readAt;
    
    @Column(name = "action_at")
    private LocalDateTime actionAt;
}
```

### 6.3 Pathfinding Request/Response

```java
public class PathfindingRequest {
    private UUID warehouseId;
    private UUID orderId;
    private List<String> pickingItemLocationCodes;
    private List<String> blockedLocationCodes;
    private String workerType;  // PICKER, PACKER, etc.
    private Long estimatedWeight;
}

public class PathfindingResponse {
    private List<PathNode> path;
    private double totalDistance;
    private long estimatedTimeSeconds;
    private List<String> instructions;  // Turn-by-turn directions
    private List<PathNode> alternativeRoutes;
    private long executionTimeMs;
    private String status;  // SUCCESS, NO_PATH_FOUND, etc.
}
```

---

## 7. Technical Specifications

### 7.1 JWT Token Structure

```json
{
  "sub": "user-id-uuid",
  "username": "john.doe",
  "email": "john@warehouse.com",
  "role": "picker",
  "warehouse_id": "warehouse-uuid",
  "iat": 1703001600,
  "exp": 1703088000,
  "jti": "token-id-uuid"
}
```

### 7.2 Authentication Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Request-Id: unique-request-id
X-Warehouse-Id: warehouse-uuid (optional)
```

### 7.3 Error Response Format

```json
{
  "status": "error",
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "details": {
    "field": "email",
    "error": "User not found"
  },
  "timestamp": "2024-04-10T10:30:45Z",
  "path": "/api/auth/login"
}
```

---

## 8. Security Considerations

### 8.1 Password Security
- Minimum 10 characters, mixed case, numbers, special characters
- Bcrypt hashing with salt rounds ≥ 12
- Password history (prevent reuse of last 5 passwords)
- Automatic expiration every 90 days (optional)

### 8.2 JWT Security
- HS256 signing algorithm
- Token expiration: 1 hour
- Refresh token expiration: 30 days
- Token revocation on logout
- Secure HTTP-only cookies (optional)

### 8.3 Rate Limiting
- 5 failed login attempts = 15 min lockout
- Auth endpoints: 10 requests/minute per IP
- Notification endpoints: 100 requests/minute per user
- Pathfinding: 1000 requests/minute per user

### 8.4 CORS & CSRF
- CORS restricted to frontend origin
- CSRF tokens for state-changing operations
- Same-Site cookie policy: Strict

---

## 9. File Structure Summary

```
backend/
├── core-domain/
│   └── users/
│       ├── User.java
│       ├── UserRole.java
│       └── UserStatus.java
├── core-app/
│   ├── users/
│   │   ├── UserService.java
│   │   ├── AuthService.java
│   │   └── PasswordService.java
│   ├── notifications/
│   │   ├── NotificationService.java
│   │   ├── AlertType.java
│   │   └── AlertSeverity.java
│   └── pathfinding/
│       ├── AStarPathfinder.java
│       ├── PathfindingService.java
│       ├── WarehouseGraph.java
│       └── PathNode.java
├── core-api/
│   ├── auth/
│   │   ├── JwtTokenProvider.java
│   │   ├── JwtAuthenticationFilter.java
│   │   ├── CustomUserDetailsService.java
│   │   └── AuthController.java
│   ├── users/
│   │   └── UserController.java
│   ├── notifications/
│   │   └── NotificationController.java
│   ├── controller/
│   │   └── PathfindingController.java
│   └── config/
│       └── SecurityConfig.java
└── infra/
    ├── users/
    │   ├── UserEntity.java
    │   └── UserRepository.java
    └── notifications/
        ├── NotificationEntity.java
        └── NotificationRepository.java

frontend/
├── app/
│   ├── admin/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── worker/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── picking/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   └── layout.tsx
├── components/
│   ├── Topbar.tsx
│   ├── ProfileMenu.tsx
│   ├── NotificationBell.tsx
│   ├── UserMenu.tsx
│   ├── PickingRouteGuide.tsx
│   ├── PathVisualizerNew.tsx
│   └── WarehouseVisualizationNew.tsx
├── lib/
│   ├── auth/
│   │   ├── AuthContext.tsx
│   │   └── useAuth.ts
│   ├── api/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── notifications.ts
│   │   └── pathfinding.ts
│   └── hooks/
│       ├── useNotifications.ts
│       ├── useAuth.ts
│       └── usePathfinding.ts
└── contexts/
    ├── AuthContext.tsx
    ├── AdminContext.tsx
    └── WorkerContext.tsx
```

---

## 10. Success Criteria

### Authentication
- ✅ Any user can login with valid credentials
- ✅ Invalid credentials return 401 error
- ✅ JWT token generated and returned on success
- ✅ Token valid for all subsequent requests
- ✅ Logout invalidates token
- ✅ Expired tokens trigger refresh flow

### Notifications
- ✅ Notifications stored in database
- ✅ Users see only their own notifications
- ✅ Notifications retrievable by type/date/severity
- ✅ Mark read/unread functionality works
- ✅ Unread count accurate
- ✅ Real-time delivery (WebSocket or polling)

### Pathfinding
- ✅ A* finds optimal path for any valid start/end
- ✅ Route avoids blocked locations
- ✅ Response time < 5ms for typical warehouse
- ✅ Visual path display on map
- ✅ Turn-by-turn instructions generated
- ✅ Alternative routes suggested when available

### Frontend
- ✅ Login pages responsive and user-friendly
- ✅ Topbar displays current user info
- ✅ Notifications display in real-time
- ✅ Logout works and clears session
- ✅ Mobile support for worker interface
- ✅ Picking route integrated and actionable

---

## 11. Testing Strategy

### Unit Tests
- UserService: CRUD, password hashing, validation
- NotificationService: Create, retrieve, update operations
- AStarPathfinder: Algorithm correctness, edge cases
- AuthService: Token generation, validation, expiry

### Integration Tests
- Auth flow: Login → Token → Profile → Logout
- Notification workflow: Create → Retrieve → Read → Delete
- Pathfinding: Graph build → Route search → Response format

### End-to-End Tests
- Admin login → Dashboard access → User management
- Worker login → Picking task → Route navigation → Completion
- Notification creation → Display → Action

### Security Tests
- SQL injection attempts on login
- JWT tampering detection
- CORS origin validation
- Rate limiting enforcement

---

## 12. Deployment Checklist

- [ ] All unit tests passing (>85% coverage)
- [ ] All integration tests passing
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance testing complete
- [ ] Documentation updated
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] API endpoints documented
- [ ] Frontend build optimized
- [ ] Error logging configured
- [ ] Monitoring/alerting set up

---

## 13. References & Resources

- **JWT Documentation**: [jwt.io](https://jwt.io)
- **A* Algorithm**: [Wikipedia A*](https://en.wikipedia.org/wiki/A*_search_algorithm)
- **Spring Security**: [Spring.io Docs](https://spring.io/projects/spring-security)
- **React Hooks**: [React Docs](https://react.dev/reference/react)
- **Next.js Documentation**: [nextjs.org](https://nextjs.org)

---

**Document Version**: 2.0  
**Last Updated**: 2024-04-10  
**Author**: YOONUS M.S.M. (235548G)  
**Status**: In Progress
