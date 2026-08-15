import { logger } from "@/lib/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Check if user is authenticated
function isAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}

// Redirect to login if not authenticated
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    // Only redirect if we're on an admin page
    if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
      window.location.href = '/admin/login';
    } else if (window.location.pathname.startsWith('/worker') && window.location.pathname !== '/worker/login') {
      window.location.href = '/worker/login';
    }
  }
}

// Get auth credentials from localStorage
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Use JWT token from localStorage
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/** Longest server message we are willing to render verbatim in a toast. */
const MAX_USER_FACING_ERROR_LENGTH = 240;

/**
 * Keep raw persistence failures out of the UI.
 *
 * Some endpoints let database exceptions escape, which produced multi-kilobyte
 * messages containing the generated SQL. Those are logged in full but replaced with
 * something an operator can act on before they reach a toast.
 */
function toUserFacingError(status: number, rawMessage: string): string {
  const message = (rawMessage || '').trim();
  const looksLikeDatabaseDump =
    /could not execute|batch entry|violates .*constraint|org\.hibernate|jakarta\.persistence|SQLState/i.test(
      message
    );

  if (looksLikeDatabaseDump) {
    return status >= 500
      ? 'The server could not complete this change. Please try again.'
      : 'This change conflicts with existing warehouse data and was not saved.';
  }

  if (!message) {
    return `Request failed (${status}). Please try again.`;
  }

  if (message.length > MAX_USER_FACING_ERROR_LENGTH) {
    return `${message.slice(0, MAX_USER_FACING_ERROR_LENGTH).trimEnd()}…`;
  }

  return message;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    logger.error(`[API Client] Response not OK: ${response.status} ${response.statusText}`);
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      logger.error("[API Client] 401 Unauthorized - attempting token refresh");
      
      // We no longer check localStorage for refreshToken as it's an HttpOnly cookie.
      // We just attempt to refresh if we have an accessToken (meaning we were logged in).
      const accessToken = localStorage.getItem('accessToken');
      
      // Try to refresh token
      if (accessToken) {
        try {
          const { authApi } = await import('./auth');
          const refreshResponse = await authApi.refresh();
          
          if (refreshResponse.success && refreshResponse.accessToken) {
            // Token refreshed successfully - user should retry the request
            throw new Error('__TOKEN_REFRESHED_RETRY__');
          } else {
            // Refresh failed - clear tokens and redirect
            logger.error("[API Client] Token refresh failed");
            authApi.logout();
            redirectToLogin();
            throw new Error('Session expired. Please login again.');
          }
        } catch (refreshError) {
          // Refresh succeeded and token is updated; caller should retry.
          if (
            refreshError instanceof Error &&
            refreshError.message === '__TOKEN_REFRESHED_RETRY__'
          ) {
            throw new Error('Session refreshed. Please try again.');
          }

          // Refresh failed - clear tokens and redirect
          logger.error("[API Client] Token refresh error:", refreshError);
          const { authApi } = await import('./auth');
          authApi.logout();
          redirectToLogin();
          throw new Error('Session expired. Please login again.');
        }
      } else {
        // Not logged in at all - redirect to login
        logger.error("[API Client] No active session available");
        redirectToLogin();
        throw new Error('Not authenticated. Please login.');
      }
    }
    
    const extractErrorMessage = (errorData: any, fallback: string): string => {
      // Important: prefer `message` over `error`.
      // Spring responses commonly send { error: "Bad Request", message: "<real cause>" }.
      // If we prioritize `error`, the root cause gets masked globally.
      if (errorData?.message && typeof errorData.message === 'string') {
        return errorData.message;
      }
      if (errorData?.detail && typeof errorData.detail === 'string') {
        return errorData.detail;
      }
      if (errorData?.error && typeof errorData.error === 'string') {
        const genericError = ['bad request', 'internal server error', 'forbidden', 'unauthorized']
          .includes(errorData.error.toLowerCase().trim());
        if (genericError && typeof fallback === 'string' && fallback.trim().length > 0) {
          return fallback;
        }
        return errorData.error;
      }
      if (typeof errorData === 'string') {
        return errorData;
      }
      return fallback;
    };

    // Handle 403 Forbidden - User doesn't have permission
    if (response.status === 403) {
      logger.error("[API Client] 403 Forbidden - User doesn't have permission");
      let errorMessage = 'Access denied. You do not have permission to access this resource.';
      try {
        const errorData = await response.json();
        errorMessage = extractErrorMessage(errorData, errorMessage);
      } catch (e) {
        // Use default message
      }
      throw new Error(`Access Denied: ${errorMessage}`);
    }
    
    // Parse error body from text first (single read), then try JSON.
    let errorMessage = response.statusText;
    try {
      const rawText = await response.text();
      if (rawText && rawText.trim() !== '') {
        try {
          const errorData = JSON.parse(rawText);
          errorMessage = extractErrorMessage(errorData, rawText);
        } catch {
          errorMessage = rawText;
        }
      }
    } catch {
      errorMessage = response.statusText;
    }
    
    logger.error(`[API Client] Error response: ${errorMessage}`);
    throw new Error(toUserFacingError(response.status, errorMessage));
  }
  
  // Handle 204 No Content (empty response)
  if (response.status === 204 || response.status === 201) {
    // Check if response has content
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    // If no content or empty content, return undefined
    if (!contentType || contentLength === '0' || !contentType.includes('application/json')) {
      return undefined as T;
    }
  }
  
  // Check if response has content before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // Not JSON, return empty or text
    if (response.status === 204) {
      return undefined as T;
    }
    try {
      const text = await response.text();
      return (text || undefined) as T;
    } catch {
      return undefined as T;
    }
  }
  
  try {
    const text = await response.text();
    // If empty string, return undefined
    if (!text || text.trim() === '') {
      return undefined as T;
    }
    const data = JSON.parse(text);
    return data;
  } catch (jsonError) {
    logger.error("[API Client] JSON parse error:", jsonError);
    // For 204 No Content, this is expected - return undefined
    if (response.status === 204) {
      return undefined as T;
    }
    throw new Error('Invalid response from server');
  }
}

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    // Check authentication for protected endpoints (not auth endpoints)
    if (!endpoint.startsWith('/auth/') && !isAuthenticated()) {
      logger.error(`[API Client] Not authenticated for ${endpoint}`);
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    logger.debug(`[API Client] GET ${endpoint}`);
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = getAuthHeaders();
    logger.debug(`[API Client] Request URL: ${url}`);
    logger.debug(`[API Client] Has auth header: ${!!headers['Authorization']}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers as HeadersInit,
        credentials: 'include',
      });
      logger.debug(`[API Client] Response status: ${response.status}`);
      return handleResponse<T>(response);
    } catch (fetchError) {
      logger.error(`[API Client] Fetch error for ${endpoint}:`, fetchError);
      throw fetchError;
    }
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    // Check authentication for protected endpoints
    if (!endpoint.startsWith('/auth/') && !isAuthenticated()) {
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    const headers = getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: headers as HeadersInit,
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(endpoint: string, data: any): Promise<T> {
    if (!isAuthenticated()) {
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  },

  async patch<T>(endpoint: string, data: any): Promise<T> {
    if (!isAuthenticated()) {
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  },

  async delete<T>(endpoint: string): Promise<T> {
    if (!isAuthenticated()) {
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    return handleResponse<T>(response);
  },

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    if (!isAuthenticated()) {
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    const headers: HeadersInit = {};
    // Use JWT token from localStorage
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    // Don't set Content-Type for FormData, browser will set it with boundary

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
    return handleResponse<T>(response);
  },
};
