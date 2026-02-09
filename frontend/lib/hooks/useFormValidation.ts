/**
 * Reusable form validation hook
 * Provides client-side validation for forms without sending to backend
 */

import { useState, useCallback } from 'react';
import { validateEmail, validatePhone, validateRequired, validatePostalCode, validateQuantity, validateFutureDate, ValidationResult } from '@/lib/utils/form-validation';

export interface ValidationErrors {
  [key: string]: string;
}

export function useFormValidation() {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback((fieldName: string, value: any, validator: (value: any) => ValidationResult) => {
    const result = validator(value);
    if (!result.valid) {
      setErrors(prev => ({ ...prev, [fieldName]: result.error || '' }));
      return false;
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    }
  }, []);

  const validateForm = useCallback((fields: Record<string, ValidationResult>) => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    for (const [fieldName, result] of Object.entries(fields)) {
      if (!result.valid) {
        newErrors[fieldName] = result.error || '';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, []);

  const clearError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    clearError,
    clearAllErrors,
    hasErrors: Object.keys(errors).length > 0,
  };
}

// Export validation functions for direct use
export { validateEmail, validatePhone, validateRequired, validatePostalCode, validateQuantity, validateFutureDate };
