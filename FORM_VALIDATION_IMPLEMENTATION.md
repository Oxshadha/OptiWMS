# 📋 Form Validation Implementation Guide

**Date**: January 2026  
**Status**: ✅ **IMPLEMENTED**

---

## 🎯 Overview

Client-side form validation has been implemented across the admin dashboard to validate data **before** sending to the backend. This improves user experience and reduces unnecessary API calls.

---

## ✅ What's Been Implemented

### **1. Validation Utilities** (`frontend/lib/utils/form-validation.ts`)

**Available Validators:**
- `validateEmail()` - Validates email format
- `validatePhone()` - Validates phone numbers (international format)
- `validateRequired()` - Checks if field is not empty
- `validatePostalCode()` - Validates postal/zip codes
- `validateQuantity()` - Validates positive whole numbers
- `validateFutureDate()` - Ensures date is not in the past

### **2. Country List** (`frontend/lib/utils/countries.ts`)

- **60+ countries** including Sri Lanka, India, and all major countries
- **Alphabetically sorted** for easy selection
- **Custom country option** - Users can enter any country not in the list

### **3. Reusable Validation Hook** (`frontend/lib/hooks/useFormValidation.ts`)

Provides easy-to-use validation for any form:
```typescript
const { errors, validateField, validateForm, clearError } = useFormValidation();
```

---

## 🔧 Forms Updated

### **✅ Outbound Order Creation** (`/admin/orders/outbound`)

**Changes:**
1. **Simplified Address Fields:**
   - Address Line 1 (required)
   - Address Line 2 (optional)
   - City, State, Country fields remain for auto-fill or manual entry

2. **Country Selection:**
   - 60+ countries including **Sri Lanka**
   - "Other (Enter custom country)" option for new countries
   - Custom country input field appears when "Other" is selected

3. **Client-Side Validation:**
   - Email format validation
   - Phone number validation (7-15 digits, accepts + prefix)
   - Required field validation
   - Postal code validation
   - Real-time error messages below fields

4. **Address Storage:**
   - Combines Line 1 and Line 2 into full address
   - Stores complete address in database

### **✅ Customer Form** (`/admin/customers`)

**Changes:**
- Email validation with error messages
- Phone validation with error messages
- Required field validation

---

## 📝 How to Apply Validation to Other Forms

### **Step 1: Import Validation Functions**

```typescript
import { validateEmail, validatePhone, validateRequired } from "@/lib/utils/form-validation";
```

### **Step 2: Add Validation State**

```typescript
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
```

### **Step 3: Add Validation to Input Fields**

```typescript
<input
  type="email"
  className={`input input-bordered w-full ${validationErrors.email ? 'input-error' : ''}`}
  value={formData.email}
  onChange={(e) => {
    setFormData({ ...formData, email: e.target.value });
    if (validationErrors.email) {
      setValidationErrors({ ...validationErrors, email: "" });
    }
  }}
  onBlur={async () => {
    const { validateEmail } = await import("@/lib/utils/form-validation");
    const result = validateEmail(formData.email);
    if (!result.valid) {
      setValidationErrors({ ...validationErrors, email: result.error || "" });
    }
  }}
/>
{validationErrors.email && (
  <label className="label">
    <span className="label-text-alt text-error">{validationErrors.email}</span>
  </label>
)}
```

### **Step 4: Validate Before Submit**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const errors: Record<string, string> = {};
  const emailResult = validateEmail(formData.email);
  if (!emailResult.valid) errors.email = emailResult.error || "";
  
  const phoneResult = validatePhone(formData.phone);
  if (!phoneResult.valid) errors.phone = phoneResult.error || "";
  
  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    showToast.error("Please fix the validation errors before submitting");
    return;
  }
  
  // Proceed with submission...
};
```

---

## 🌍 Country Selection Pattern

### **Using Country List:**

```typescript
import { SORTED_COUNTRIES } from "@/lib/utils/countries";

<select
  value={formData.country}
  onChange={(e) => {
    setFormData({ 
      ...formData, 
      country: e.target.value,
      customCountry: e.target.value === "CUSTOM" ? formData.customCountry : ""
    });
  }}
>
  <option value="">Select country</option>
  {SORTED_COUNTRIES.map((country) => (
    <option key={country.code} value={country.name}>
      {country.name}
    </option>
  ))}
  <option value="CUSTOM">Other (Enter custom country)</option>
</select>

{formData.country === "CUSTOM" && (
  <input
    type="text"
    className="input input-bordered w-full mt-2"
    value={formData.customCountry}
    onChange={(e) => setFormData({ ...formData, customCountry: e.target.value })}
    placeholder="Enter country name"
  />
)}
```

---

## 📋 Forms That Need Validation (Priority List)

### **High Priority:**
1. ✅ **Outbound Orders** - DONE
2. ✅ **Customers** - DONE
3. ⏳ **Suppliers** - Needs validation
4. ⏳ **Delivery Partners** - Needs validation
5. ⏳ **Workers** - Needs validation
6. ⏳ **Admins** - Needs validation
7. ⏳ **Inbound Orders** - Needs validation

### **Medium Priority:**
- Shipments
- Returns
- Tasks
- Warehouses

---

## 🎨 Validation Error Display

**Visual Indicators:**
- Input field gets `input-error` class (red border)
- Error message appears below field in red text
- Error clears when user starts typing

**Example:**
```
[Input Field with red border]
  ↓
  Error message in red text
```

---

## 📱 Phone Number Formats Accepted

- `+94 77 123 4567` ✅
- `0771234567` ✅
- `+1-555-123-4567` ✅
- `(555) 123-4567` ✅
- `1234567890` ✅
- `abc123` ❌ (Invalid)

---

## ✨ Benefits

1. **Better UX** - Users see errors immediately, not after server round-trip
2. **Faster Feedback** - No waiting for backend response
3. **Reduced Server Load** - Invalid requests never reach backend
4. **Consistent Validation** - Same rules across all forms
5. **User-Friendly Messages** - Clear, actionable error messages

---

## 🔄 Next Steps

To add validation to other forms:

1. Import validation utilities
2. Add validation state
3. Add `onBlur` handlers to inputs
4. Add error display below fields
5. Validate before form submission

**Pattern is consistent** - just copy from Outbound Orders or Customers form!

---

**Last Updated**: January 2026  
**Status**: ✅ Core validation implemented - Ready to apply to other forms
