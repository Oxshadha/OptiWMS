import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import './AdminLoginForm.module.css';

interface AdminLoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function AdminLoginForm({ onSubmit, isLoading = false, error }: AdminLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Validation
    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }

    if (!password) {
      setLocalError('Password is required');
      return;
    }

    if (!isValidEmail(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    try {
      await onSubmit(email, password);
    } catch (err: any) {
      setLocalError(err.message || 'Login failed. Please try again.');
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const displayError = error || localError;

  return (
    <form onSubmit={handleSubmit} className="admin-login-form">
      {displayError && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{displayError}</span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          placeholder="admin@optiwms.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="form-input"
          autoComplete="email"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <div className="password-field">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="form-input"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="toggle-password-btn"
            disabled={isLoading}
            aria-label="Toggle password visibility"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <div className="form-options">
        <label className="remember-me">
          <input type="checkbox" defaultChecked />
          Remember me
        </label>
        <a href="/admin/forgot-password" className="forgot-password-link">
          Forgot Password?
        </a>
      </div>

      <button
        type="submit"
        className={`submit-button ${isLoading ? 'loading' : ''}`}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="spinner"></div>
            <span>Signing in...</span>
          </>
        ) : (
          'Sign In'
        )}
      </button>

      <div className="form-footer">
        <p>
          Don't have an account?{' '}
          <span style={{ color: '#999' }}>Contact your administrator</span>
        </p>
      </div>
    </form>
  );
}
