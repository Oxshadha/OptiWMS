# 🏢 Enterprise-Level Phone & Postal Code Validation

**Date**: January 2026  
**Status**: ✅ **IMPLEMENTED**

---

## 🎯 Overview

Enterprise-level validation for phone numbers and postal codes that varies by country. Uses industry-standard libraries used by Google, WhatsApp, and other major platforms.

---

## 📦 Required Libraries

### **1. libphonenumber-js**
**Industry Standard**: Used by Google, WhatsApp, Facebook, etc.

**Installation:**
```bash
cd frontend
npm install libphonenumber-js
```

**What it does:**
- Validates phone numbers by country code
- Supports 200+ countries
- Handles international formats
- Validates mobile vs landline numbers
- Formats numbers correctly

**Example:**
```typescript
import { isValidNumber, parsePhoneNumber } from 'libphonenumber-js';

// Sri Lankan mobile
isValidNumber('0771234567', 'LK'); // true

// US number
isValidNumber('2133734253', 'US'); // true

// UK number
isValidNumber('020 7946 0958', 'GB'); // true
```

### **2. postal-codes-js**
**Comprehensive**: Validates postal codes for all countries

**Installation:**
```bash
cd frontend
npm install postal-codes-js
```

**What it does:**
- Validates postal codes by country code
- Supports all ISO 3166-1 countries
- Country-specific format validation
- Returns helpful error messages

**Example:**
```typescript
import postalCodes from 'postal-codes-js';

// US ZIP code
postalCodes.validate('US', '12345'); // true

// UK postcode
postalCodes.validate('GB', 'SW1A 1AA'); // true

// Sri Lankan postal code
postalCodes.validate('LK', '00100'); // true
```

---

## 🔧 Implementation

### **Updated Validation Functions**

The validation utilities (`frontend/lib/utils/form-validation.ts`) now support:

1. **Country-Specific Phone Validation:**
   ```typescript
   await validatePhone("0771234567", "LK"); // Validates for Sri Lanka
   await validatePhone("+1 213 373 4253", "US"); // Validates for USA
   ```

2. **Country-Specific Postal Code Validation:**
   ```typescript
   await validatePostalCode("12345", "US"); // Validates US ZIP
   await validatePostalCode("SW1A 1AA", "GB"); // Validates UK postcode
   ```

3. **Backward Compatibility:**
   - Synchronous versions available: `validatePhoneSync()`, `validatePostalCodeSync()`
   - Falls back to basic validation if libraries not installed
   - Works without country code (uses basic validation)

---

## 📋 How to Use in Forms

### **Step 1: Get Country Code**

```typescript
import { getCountryCodeFromName } from "@/lib/utils/countries";

const countryCode = getCountryCodeFromName(formData.deliveryCountry);
// Returns "LK" for "Sri Lanka", "US" for "United States", etc.
```

### **Step 2: Validate Phone Number**

```typescript
import { validatePhone } from "@/lib/utils/form-validation";
import { getCountryCodeFromName } from "@/lib/utils/countries";

// In your form validation
const countryCode = getCountryCodeFromName(formData.deliveryCountry);
const phoneResult = await validatePhone(formData.customerPhone, countryCode);

if (!phoneResult.valid) {
  setValidationErrors({ ...validationErrors, phone: phoneResult.error });
}
```

### **Step 3: Validate Postal Code**

```typescript
import { validatePostalCode } from "@/lib/utils/form-validation";
import { getCountryCodeFromName } from "@/lib/utils/countries";

// In your form validation
const countryCode = getCountryCodeFromName(formData.deliveryCountry);
const postalResult = await validatePostalCode(formData.postalCode, countryCode);

if (!postalResult.valid) {
  setValidationErrors({ ...validationErrors, postalCode: postalResult.error });
}
```

### **Step 4: Update Form Input Handlers**

```typescript
// Phone input with country-specific validation
<input
  type="tel"
  className={`input input-bordered w-full ${validationErrors.phone ? 'input-error' : ''}`}
  value={formData.phone}
  onChange={(e) => {
    setFormData({ ...formData, phone: e.target.value });
    if (validationErrors.phone) {
      setValidationErrors({ ...validationErrors, phone: "" });
    }
  }}
  onBlur={async () => {
    const { validatePhone } = await import("@/lib/utils/form-validation");
    const { getCountryCodeFromName } = await import("@/lib/utils/countries");
    
    const countryCode = getCountryCodeFromName(formData.country);
    const result = await validatePhone(formData.phone, countryCode);
    
    if (!result.valid) {
      setValidationErrors({ ...validationErrors, phone: result.error || "" });
    }
  }}
  placeholder="Enter phone number"
/>
{validationErrors.phone && (
  <label className="label">
    <span className="label-text-alt text-error">{validationErrors.phone}</span>
  </label>
)}
```

---

## 🌍 Country-Specific Examples

### **Sri Lanka (LK)**
- **Phone**: `0771234567`, `+94 77 123 4567` ✅
- **Postal Code**: `00100`, `01000` ✅

### **United States (US)**
- **Phone**: `2133734253`, `+1 213 373 4253` ✅
- **Postal Code**: `12345`, `12345-6789` ✅

### **United Kingdom (GB)**
- **Phone**: `020 7946 0958`, `+44 20 7946 0958` ✅
- **Postal Code**: `SW1A 1AA`, `EC1A 1BB` ✅

### **India (IN)**
- **Phone**: `9876543210`, `+91 98765 43210` ✅
- **Postal Code**: `110001`, `400001` ✅

---

## ⚡ Performance

- **Lazy Loading**: Libraries are loaded only when needed
- **Async Validation**: Non-blocking validation
- **Fallback**: Works even if libraries not installed
- **Bundle Size**: Only loads validation code when used

---

## 🔄 Migration Guide

### **For Existing Forms:**

1. **Update imports:**
   ```typescript
   // Old
   import { validatePhone, validatePostalCode } from "@/lib/utils/form-validation";
   
   // New (async)
   const { validatePhone, validatePostalCode } = await import("@/lib/utils/form-validation");
   const { getCountryCodeFromName } = await import("@/lib/utils/countries");
   ```

2. **Update validation calls:**
   ```typescript
   // Old
   const result = validatePhone(formData.phone);
   
   // New
   const countryCode = getCountryCodeFromName(formData.country);
   const result = await validatePhone(formData.phone, countryCode);
   ```

3. **Update form handlers:**
   - Change `onBlur` to `async`
   - Pass country code to validation functions

---

## ✅ Benefits

1. **Enterprise-Grade**: Uses same libraries as Google, WhatsApp
2. **Country-Specific**: Validates according to each country's rules
3. **Accurate**: Handles edge cases and international formats
4. **User-Friendly**: Provides country-specific error messages
5. **No Backend Calls**: All validation happens client-side
6. **Future-Proof**: Libraries are actively maintained

---

## 📚 Resources

- **libphonenumber-js**: https://github.com/catamphetamine/libphonenumber-js
- **postal-codes-js**: https://github.com/AndreasPizsa/postal-codes-js
- **Google libphonenumber**: https://github.com/google/libphonenumber

---

## 🚀 Next Steps

1. **Install libraries:**
   ```bash
   cd frontend
   npm install libphonenumber-js postal-codes-js
   ```

2. **Update forms** to use country-specific validation (see examples above)

3. **Test** with various countries and formats

---

**Last Updated**: January 2026  
**Status**: ✅ Ready to use - Install libraries and update forms
