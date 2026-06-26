import React, { useState } from 'react';
import { LogOut, User, Settings, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { authApi } from '@/lib/api/auth';
import './ProfileMenu.module.css';

export function ProfileMenu() {
  const router = useRouter();
  const { admin, role, clearAdmin } = useAdmin();
  const [isLoading, setIsLoading] = useState(false);
  const displayName = admin?.name?.trim() || admin?.email || "Admin";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await authApi.logout();
      clearAdmin();
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <div className="profile-menu">
      <div className="profile-header">
        <div className="profile-avatar">
          {initials || "A"}
        </div>
        <div className="profile-info">
          <div className="profile-name">{displayName}</div>
          <div className="profile-role">{role?.replace('_', ' ').toUpperCase()}</div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-email">
          <strong>Email:</strong> {admin?.email}
        </div>
        {admin?.warehouseId && (
          <div className="profile-warehouse">
            <strong>Warehouse:</strong> {admin?.warehouseName || 'N/A'}
          </div>
        )}
      </div>

      <div className="profile-actions">
        <button
          className="profile-action-btn"
          onClick={() => handleNavigate('/admin/profile')}
        >
          <User size={16} />
          <span>My Profile</span>
        </button>

        <button
          className="profile-action-btn"
          onClick={() => handleNavigate('/admin/settings')}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>

        <button
          className="profile-action-btn"
          onClick={() => handleNavigate('/help')}
        >
          <HelpCircle size={16} />
          <span>Help & Support</span>
        </button>
      </div>

      <button
        className="logout-btn"
        onClick={handleLogout}
        disabled={isLoading}
      >
        <LogOut size={16} />
        <span>{isLoading ? 'Signing out...' : 'Sign Out'}</span>
      </button>
    </div>
  );
}
