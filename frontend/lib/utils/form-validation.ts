/**
 * Enterprise-level client-side form validation utilities
 * Uses industry-standard libraries for country-specific validation
 * Validates data before sending to backend
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Lazy load validation libraries to reduce bundle size
let phoneValidationLib: any = null;
let postalCodeValidationLib: any = null;

/**
 * Lazy load libphonenumber-js
 * This library is used by Google, WhatsApp, and other major platforms
 */
async function getPhoneValidationLib() {
  if (!phoneValidationLib) {
    try {
      phoneValidationLib = await import('libphonenumber-js');
    } catch (err) {
      console.warn('libphonenumber-js not installed. Install with: npm install libphonenumber-js');
      return null;
    }
  }
  return phoneValidationLib;
}

/**
 * Lazy load postal-codes-js
 * Validates postal codes for all countries
 */
async function getPostalCodeValidationLib() {
  if (!postalCodeValidationLib) {
    try {
      postalCodeValidationLib = await import('postal-codes-js');
    } catch (err) {
      console.warn('postal-codes-js not installed. Install with: npm install postal-codes-js');
      return null;
    }
  }
  return postalCodeValidationLib;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === "") {
    return { valid: true }; // Email is optional in most forms
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: "Please enter a valid email address" };
  }
  
  return { valid: true };
}

/**
 * Validate phone number using enterprise-level validation (libphonenumber-js)
 * This is the same library used by Google, WhatsApp, and other major platforms
 * 
 * @param phone - Phone number to validate
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "US", "LK", "GB")
 * @returns ValidationResult with validation status and error message
 * 
 * Examples:
 * - validatePhone("0771234567", "LK") - Valid Sri Lankan mobile
 * - validatePhone("+1 213 373 4253", "US") - Valid US number
 * - validatePhone("020 7946 0958", "GB") - Valid UK number
 */
export async function validatePhone(phone: string, countryCode?: string): Promise<ValidationResult> {
  if (!phone || phone.trim() === "") {
    return { valid: true }; // Phone is optional in most forms
  }
  
  // If country code is provided, use enterprise-level validation
  if (countryCode) {
    const lib = await getPhoneValidationLib();
    if (lib) {
      try {
        const { isValidNumber, parsePhoneNumber } = lib;
        
        // Try to parse and validate the phone number
        const phoneNumber = parsePhoneNumber(phone, countryCode as any);
        
        if (phoneNumber && isValidNumber(phoneNumber.number)) {
          return { valid: true };
        } else {
          // Get example format for the country
          const example = phoneNumber?.formatInternational() || phone;
          return { 
            valid: false, 
            error: `Please enter a valid phone number for ${countryCode}. Example: ${example}` 
          };
        }
      } catch (err) {
        // If parsing fails, fall back to basic validation
        console.warn('Phone validation error:', err);
      }
    }
  }
  
  // Fallback: Basic validation if library not available or no country code
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  if (!phoneRegex.test(cleaned)) {
    return { valid: false, error: "Please enter a valid phone number (7-15 digits)" };
  }
  
  return { valid: true };
}

/**
 * Synchronous version of validatePhone for backward compatibility
 * Uses basic validation if country code not provided
 */
export function validatePhoneSync(phone: string, countryCode?: string): ValidationResult {
  if (!phone || phone.trim() === "") {
    return { valid: true };
  }
  
  // Basic validation fallback
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  if (!phoneRegex.test(cleaned)) {
    return { valid: false, error: "Please enter a valid phone number (7-15 digits)" };
  }
  
  return { valid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim() === "") {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

/**
 * Validate postal code using enterprise-level validation (postal-codes-js)
 * Validates postal codes according to country-specific formats
 * 
 * @param postalCode - Postal/ZIP code to validate
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "US", "LK", "GB")
 * @returns ValidationResult with validation status and error message
 * 
 * Examples:
 * - validatePostalCode("12345", "US") - Valid US ZIP code
 * - validatePostalCode("SW1A 1AA", "GB") - Valid UK postcode
 * - validatePostalCode("00100", "LK") - Valid Sri Lankan postal code
 */
export async function validatePostalCode(postalCode: string, countryCode?: string): Promise<ValidationResult> {
  if (!postalCode || postalCode.trim() === "") {
    return { valid: true }; // Postal code is usually optional
  }
  
  // If country code is provided, use enterprise-level validation
  if (countryCode) {
    const lib = await getPostalCodeValidationLib();
    if (lib) {
      try {
        const result = lib.validate(countryCode, postalCode.trim());
        
        if (result === true) {
          return { valid: true };
        } else {
          // Result is an error message string
          return { 
            valid: false, 
            error: typeof result === 'string' ? result : `Invalid postal code format for ${countryCode}` 
          };
        }
      } catch (err) {
        // If validation fails, fall back to basic validation
        console.warn('Postal code validation error:', err);
      }
    }
  }
  
  // Fallback: Basic validation if library not available or no country code
  // Allow alphanumeric, 3-10 characters (covers most countries)
  const postalCodeRegex = /^[A-Z0-9\s\-]{3,10}$/i;
  if (!postalCodeRegex.test(postalCode.trim())) {
    return { valid: false, error: "Please enter a valid postal code" };
  }
  
  return { valid: true };
}

/**
 * Synchronous version of validatePostalCode for backward compatibility
 * Uses basic validation if country code not provided
 */
export function validatePostalCodeSync(postalCode: string, countryCode?: string): ValidationResult {
  if (!postalCode || postalCode.trim() === "") {
    return { valid: true };
  }
  
  // Basic validation fallback
  const postalCodeRegex = /^[A-Z0-9\s\-]{3,10}$/i;
  if (!postalCodeRegex.test(postalCode.trim())) {
    return { valid: false, error: "Please enter a valid postal code" };
  }
  
  return { valid: true };
}

/**
 * Validate quantity (must be positive number)
 */
export function validateQuantity(quantity: number | string, fieldName: string = "Quantity"): ValidationResult {
  const num = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: `${fieldName} must be a positive number` };
  }
  
  if (!Number.isInteger(num) && num % 1 !== 0) {
    return { valid: false, error: `${fieldName} must be a whole number` };
  }
  
  return { valid: true };
}

/**
 * Validate date (must be in the future or today)
 */
export function validateFutureDate(date: string, fieldName: string = "Date"): ValidationResult {
  if (!date) {
    return { valid: false, error: `${fieldName} is required` };
  }
  
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (isNaN(selectedDate.getTime())) {
    return { valid: false, error: `Please enter a valid ${fieldName.toLowerCase()}` };
  }
  
  if (selectedDate < today) {
    return { valid: false, error: `${fieldName} cannot be in the past` };
  }
  
  return { valid: true };
}

/**
 * Validate multiple fields at once
 */
export function validateForm(fields: Record<string, ValidationResult>): ValidationResult {
  for (const [fieldName, result] of Object.entries(fields)) {
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}
