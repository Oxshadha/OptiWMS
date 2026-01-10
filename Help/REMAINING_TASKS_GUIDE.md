# Remaining Tasks Implementation Guide

## ✅ Completed

1. **Fixed suppliers page linting** - Removed duplicate div and fixed type references
2. **Created pagination component** - `frontend/components/Pagination.tsx`
3. **Created toast utility** - `frontend/lib/utils/toast.ts` (needs react-hot-toast package)

## 📋 Remaining Tasks

### 1. Install Toast Notifications

**Manual Step Required:**
```bash
cd frontend
npm install react-hot-toast
```

**Then add Toaster to root layout:**
```typescript
// frontend/app/layout.tsx
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="optiwms">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

**Replace alerts with toasts:**
```typescript
import { showToast } from '@/lib/utils/toast';

// Replace: alert("Success!");
showToast.success("Success!");

// Replace: alert("Error!");
showToast.error("Error occurred");
```

### 2. Connect Location Create/Edit Modals

**Create Location Modal Component:**
```typescript
// frontend/components/LocationCreateModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { locationsApi, CreateLocationRequest } from "@/lib/api/locations";
import { showToast } from "@/lib/utils/toast";

interface LocationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseId: string;
  onSuccess?: () => void;
}

export function LocationCreateModal({
  isOpen,
  onClose,
  warehouseId,
  onSuccess,
}: LocationCreateModalProps) {
  const [formData, setFormData] = useState<CreateLocationRequest>({
    warehouseId,
    locationCode: "",
    area: "",
    rowNumber: "",
    bayNumber: "",
    levelNumber: 1,
    binPosition: "",
    locationType: "storage",
    capacity: undefined,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await locationsApi.create(formData);
      showToast.success("Location created successfully!");
      onSuccess?.();
      onClose();
      // Reset form
      setFormData({
        warehouseId,
        locationCode: "",
        area: "",
        rowNumber: "",
        bayNumber: "",
        levelNumber: 1,
        binPosition: "",
        locationType: "storage",
        capacity: undefined,
        isActive: true,
      });
    } catch (error) {
      console.error("Failed to create location:", error);
      showToast.error("Failed to create location. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Location" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Form fields */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Location Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.locationCode}
            onChange={(e) => setFormData({ ...formData, locationCode: e.target.value })}
            required
            placeholder="e.g., ST-01-004-03-A"
          />
        </div>
        {/* Add more fields as needed */}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Location"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**Add to warehouses page:**
```typescript
import { LocationCreateModal } from "@/components/LocationCreateModal";

// In component:
const [showCreateLocationModal, setShowCreateLocationModal] = useState(false);

// Add button:
<button onClick={() => setShowCreateLocationModal(true)}>
  Create Location
</button>

// Add modal:
<LocationCreateModal
  isOpen={showCreateLocationModal}
  onClose={() => setShowCreateLocationModal(false)}
  warehouseId={selectedWarehouseId || ""}
  onSuccess={() => {
    // Reload layout
    if (selectedWarehouseId) {
      loadWarehouseLayout(selectedWarehouseId);
    }
  }}
/>
```

### 3. Connect Worker Pages to APIs

#### Receiving Page Updates

**File:** `frontend/app/worker/receiving/page.tsx`

```typescript
import { operationsApi } from "@/lib/api/operations";
import { showToast } from "@/lib/utils/toast";
import { ordersApi } from "@/lib/api/orders";

// Replace handleConfirm:
const handleConfirm = async () => {
  if (!scannedValue || receivedQty === 0) {
    showToast.error("Please scan a PO/ASN and enter received quantity");
    return;
  }

  try {
    // Get order details first
    const order = await operationsApi.getOrderByNumber(scannedValue);
    
    const receivedItems = items.map(item => ({
      materialId: item.sku, // Map SKU to material ID
      quantity: receivedQty.toString(),
      locationCode: "", // Can be set later in putaway
    }));

    if (blindMode) {
      await operationsApi.blindReceive({
        orderNumber: scannedValue,
        items: receivedItems,
      });
      showToast.success(`Blind receiving confirmed: ${receivedQty} units received`);
    } else {
      await operationsApi.receive({
        orderNumber: scannedValue,
        items: receivedItems,
      });
      showToast.success(`Receiving confirmed: ${receivedQty} units received`);
    }

    // Reset form
    setScannedValue("");
    setReceivedQty(0);
  } catch (error) {
    console.error("Error confirming receipt:", error);
    showToast.error("Error confirming receipt. Please try again.");
  }
};
```

#### Picking Page Updates

**File:** `frontend/app/worker/picking/page.tsx`

```typescript
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";

// Load tasks for picking
useEffect(() => {
  const loadPickingTasks = async () => {
    try {
      const tasks = await tasksApi.getAll("picking", "pending");
      // Update picks from tasks
    } catch (error) {
      console.error("Failed to load picking tasks:", error);
    }
  };
  loadPickingTasks();
}, []);

// Update handleConfirmPick:
const handleConfirmPick = async () => {
  if (!currentPick || pickedQty === 0) return;

  try {
    // Find task ID for this pick
    const taskId = currentPick.taskId; // Assuming taskId is in pick data
    
    await operationsApi.completePicking(taskId, {
      items: [{
        materialId: currentPick.sku,
        quantity: pickedQty.toString(),
        locationCode: currentPick.location,
      }],
    });
    
    showToast.success("Pick confirmed successfully!");
    // Move to next pick
  } catch (error) {
    console.error("Error confirming pick:", error);
    showToast.error("Failed to confirm pick. Please try again.");
  }
};
```

#### Putaway Page Updates

**File:** `frontend/app/worker/putaway/page.tsx`

```typescript
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";

// Load putaway tasks
useEffect(() => {
  const loadPutawayTasks = async () => {
    try {
      const tasks = await tasksApi.getAll("putaway", "pending");
      // Update task from tasks
    } catch (error) {
      console.error("Failed to load putaway tasks:", error);
    }
  };
  loadPutawayTasks();
}, []);

// Update handleConfirm:
const handleConfirm = async () => {
  if (!scannedLPN || !scannedLocation) {
    showToast.error("Please scan both LPN and location");
    return;
  }

  try {
    const taskId = task.id; // Get from task data
    
    await operationsApi.completePutaway(taskId, {
      locationCode: scannedLocation,
      lpn: scannedLPN,
    });
    
    showToast.success("Putaway completed successfully!");
    // Reset and load next task
  } catch (error) {
    console.error("Error confirming putaway:", error);
    showToast.error("Failed to complete putaway. Please try again.");
  }
};
```

### 4. Add Pagination to Pages

**Example for Inventory Page:**

```typescript
import { Pagination } from "@/components/Pagination";
import { useState, useMemo } from "react";

// In component:
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(25);

// Calculate pagination
const paginatedInventory = useMemo(() => {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredInventory.slice(start, end);
}, [filteredInventory, currentPage, itemsPerPage]);

const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

// In JSX:
<DataTable
  data={paginatedInventory}
  // ... other props
/>

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  itemsPerPage={itemsPerPage}
  totalItems={filteredInventory.length}
  showItemsPerPage={true}
  onItemsPerPageChange={setItemsPerPage}
/>
```

**Apply to:**
- Inventory page
- Orders pages (inbound/outbound)
- Tasks page
- Suppliers page
- Customers page
- Workers page

## 🎯 Priority Order

1. **Install react-hot-toast** (5 min)
2. **Add Toaster to layout** (2 min)
3. **Replace alerts with toasts** (30 min - across all pages)
4. **Create location modals** (1 hour)
5. **Connect worker pages** (2 hours)
6. **Add pagination** (1 hour per page)

## 📝 Notes

- Toast notifications provide better UX than alerts
- Pagination improves performance with large datasets
- Location modals enable full CRUD for locations
- Worker pages need task data from backend APIs

## ✅ Testing Checklist

- [ ] Toast notifications appear correctly
- [ ] Location create/edit works
- [ ] Worker pages load real task data
- [ ] Pagination works on all pages
- [ ] No console errors
- [ ] Offline functionality still works

