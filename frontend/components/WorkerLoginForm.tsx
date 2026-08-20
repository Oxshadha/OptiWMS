import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { WorkerRole, getAllWorkerRoles, ROLE_DISPLAY_NAMES } from '@/lib/worker-roles';
import './WorkerLoginForm.module.css';

interface WorkerLoginFormProps {
  onSubmit: (employeeId: string, password: string, role: WorkerRole) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function WorkerLoginForm({ onSubmit, isLoading = false, error }: WorkerLoginFormProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<WorkerRole>('picker');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string>('');

  const workerRoles = getAllWorkerRoles();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Validation
    if (!employeeId.trim()) {
      setLocalError('Employee ID is required');
      return;
    }

    if (!password) {
      setLocalError('Password is required');
      return;
    }

    if (employeeId.trim().length < 3) {
      setLocalError('Employee ID must be at least 3 characters');
      return;
    }

    try {
      await onSubmit(employeeId, password, role);
    } catch (err: any) {
      setLocalError(err.message || 'Login failed. Please try again.');
    }
  };

  const displayError = error || localError;

  return (
    <form onSubmit={handleSubmit} className="worker-login-form">
      {displayError && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{displayError}</span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="employeeId">Employee ID</label>
        <input
          id="employeeId"
          type="text"
          placeholder="e.g., EMP001"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          disabled={isLoading}
          className="form-input"
          autoComplete="username"
          maxLength={20}
        />
        <small className="form-hint">Your unique employee identifier</small>
      </div>

      <div className="form-group">
        <label htmlFor="role">Your Role</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as WorkerRole)}
          disabled={isLoading}
          className="form-select"
        >
          <option value="">Select your role...</option>
          {workerRoles.map((workerRole) => (
            <option key={workerRole} value={workerRole}>
              {ROLE_DISPLAY_NAMES[workerRole] || workerRole}
            </option>
          ))}
        </select>
        <small className="form-hint">Select your worker role for this shift</small>
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
          Remember this device
        </label>
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
          'Start Shift'
        )}
      </button>

      <div className="form-footer">
        <p>
          Forgot your password?{' '}
          <a href="/worker/forgot-password" className="forgot-password-link">
            Reset here
          </a>
        </p>
      </div>
    </form>
  );
}
