import { logger } from '@/lib/utils/logger';

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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    logger.error(`[API Client] Response not OK: ${response.status} ${response.statusText}`);
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      logger.error("[API Client] 401 Unauthorized - attempting token refresh");
      const refreshToken = localStorage.getItem('refreshToken');
      
      // Try to refresh token if we have one
      if (refreshToken) {
        try {
          const { authApi } = await import('./auth');
          const refreshResponse = await authApi.refresh(refreshToken);
          
          if (refreshResponse.success && refreshResponse.accessToken) {
            // Token refreshed successfully - user should retry the request
            throw new Error('Session refreshed. Please try again.');
          } else {
            // Refresh failed - clear tokens and redirect
            logger.error("[API Client] Token refresh failed");
            authApi.logout();
            redirectToLogin();
            throw new Error('Session expired. Please login again.');
          }
        } catch (refreshError) {
          // Refresh failed - clear tokens and redirect
          logger.error("[API Client] Token refresh error:", refreshError);
          const { authApi } = await import('./auth');
          authApi.logout();
          redirectToLogin();
          throw new Error('Session expired. Please login again.');
        }
      } else {
        // No refresh token - redirect to login
        logger.error("[API Client] No refresh token available");
        redirectToLogin();
        throw new Error('Not authenticated. Please login.');
      }
    }
    
    // Handle 403 Forbidden - User doesn't have permission
    if (response.status === 403) {
      logger.error("[API Client] 403 Forbidden - User doesn't have permission");
      let errorMessage = 'Access denied. You do not have permission to access this resource.';
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Use default message
      }
      throw new Error(`Access Denied: ${errorMessage}`);
    }
    
    // Try to parse as JSON first, fallback to text
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch (jsonError) {
      // If not JSON, try to get text
      try {
        const errorText = await response.text();
        errorMessage = errorText || response.statusText;
      } catch (textError) {
        errorMessage = response.statusText;
      }
    }
    
    console.error(`[API Client] Error response: ${errorMessage}`);
    throw new Error(`API Error: ${response.status} - ${errorMessage}`);
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
    console.error("[API Client] JSON parse error:", jsonError);
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
      console.error(`[API Client] Not authenticated for ${endpoint}`);
      redirectToLogin();
      throw new Error('Not authenticated. Please login.');
    }

    console.log(`[API Client] GET ${endpoint}`);
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = getAuthHeaders();
    console.log(`[API Client] Request URL: ${url}`);
    console.log(`[API Client] Has auth header: ${!!headers['Authorization']}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers as HeadersInit,
        credentials: 'include',
      });
      console.log(`[API Client] Response status: ${response.status}`);
      return handleResponse<T>(response);
    } catch (fetchError) {
      console.error(`[API Client] Fetch error for ${endpoint}:`, fetchError);
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

