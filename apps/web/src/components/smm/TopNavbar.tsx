import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Settings, Bell, ChevronDown, Menu, User, Wallet, ClipboardList, LogOut } from 'lucide-react';
import { formatVND } from '../../utils/formatVND';

interface TopNavbarProps {
  breadcrumbPlatform?: string;
  breadcrumbGroup?: string;
  user: {
    displayName: string;
    email: string;
    wallet?: { balance: string; reserved: string };
  } | null;
  unreadNotifications?: number;
  onOpenMobileMenu?: () => void;
  onLogoutClick?: () => void;
}

export function TopNavbar({
  breadcrumbPlatform = '',
  breadcrumbGroup = '',
  user,
  unreadNotifications = 0,
  onOpenMobileMenu,
  onLogoutClick,
}: TopNavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const username = user?.displayName ?? 'Thành viên';
  const email = user?.email ?? '';
  const truncatedUser = username.length > 15 ? username.slice(0, 15) + '...' : username;

  const initials = username
    ? username
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((x) => x[0])
        .join('')
        .toUpperCase()
    : 'U';

  const currentCrumb = breadcrumbGroup || breadcrumbPlatform || 'Tổng quan';

  const balance = user?.wallet
    ? Math.max(0, Number(user.wallet.balance) - Number(user.wallet.reserved))
    : 0;

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <header className="smm-top-header">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="smm-header-left">
        {onOpenMobileMenu && (
          <button
            type="button"
            className="smm-mobile-menu-btn"
            onClick={onOpenMobileMenu}
            aria-label="Mở menu điều hướng"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="smm-breadcrumb">
          <NavLink to="/dashboard" className="smm-crumb-home">
            Trang chủ
          </NavLink>
          <span className="smm-crumb-sep">/</span>
          <span className="smm-crumb-current">
            {currentCrumb}
          </span>
        </div>
      </div>

      {/* Center/Left: Search Bar */}
      <div className="smm-header-search">
        <Search size={16} className="smm-search-icon" />
        <input
          type="text"
          placeholder="Tìm dịch vụ seeding"
          className="smm-search-input"
        />
        <span className="smm-search-shortcut">Ctrl K</span>
      </div>

      {/* Right: Actions */}
      <div className="smm-header-right">
        {/* Settings Button */}
        <NavLink to="/profile" className="smm-header-icon-btn" title="Cài đặt">
          <Settings size={18} />
        </NavLink>

        {/* Notifications Button */}
        <NavLink to="/notifications" className="smm-header-icon-btn" title="Thông báo">
          <Bell size={18} />
          {unreadNotifications > 0 && (
            <span className="smm-notif-count-badge">{unreadNotifications}</span>
          )}
        </NavLink>

        {/* Language Selector */}
        <div className="smm-lang-selector" title="Chọn ngôn ngữ">
          <span className="smm-vn-flag" aria-hidden="true">🇻🇳</span>
          <span className="smm-lang-text">Tiếng Việt</span>
          <ChevronDown size={13} className="smm-lang-arrow" />
        </div>

        {/* User Profile with Dropdown */}
        <div className="smm-header-user-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className={`smm-header-user-btn ${dropdownOpen ? 'active' : ''}`}
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            title="Tài khoản cá nhân"
          >
            <div className="smm-header-user-avatar">
              <span>{initials}</span>
            </div>
            <span className="smm-header-username">{truncatedUser || 'Tài khoản'}</span>
            <ChevronDown
              size={13}
              className={`smm-user-dropdown-arrow ${dropdownOpen ? 'open' : ''}`}
            />
          </button>

          {/* Account Dropdown Menu */}
          {dropdownOpen && (
            <div className="smm-user-dropdown-menu" role="menu">
              {/* Header profile info */}
              <div className="smm-dropdown-header">
                <div className="smm-dropdown-avatar">
                  <span>{initials}</span>
                </div>
                <div className="smm-dropdown-user-info">
                  <div className="smm-dropdown-name" title={username}>
                    {username}
                  </div>
                  {email && (
                    <div className="smm-dropdown-email" title={email}>
                      {email}
                    </div>
                  )}
                </div>
              </div>

              <div className="smm-dropdown-divider" />

              {/* Menu Items */}
              <div className="smm-dropdown-body">
                <NavLink
                  to="/profile"
                  className="smm-dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                >
                  <User size={17} className="smm-dropdown-icon" />
                  <span>Thông tin tài khoản</span>
                </NavLink>

                <NavLink
                  to="/deposit"
                  className="smm-dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                >
                  <Wallet size={17} className="smm-dropdown-icon" />
                  <div className="smm-dropdown-balance-row">
                    <span>Số dư:</span>
                    <strong className="smm-dropdown-balance-val">{formatVND(balance)}</strong>
                  </div>
                </NavLink>

                <NavLink
                  to="/orders"
                  className="smm-dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                >
                  <ClipboardList size={17} className="smm-dropdown-icon" />
                  <span>Lịch sử giao dịch</span>
                </NavLink>
              </div>

              <div className="smm-dropdown-divider" />

              {/* Logout Option */}
              <div className="smm-dropdown-footer">
                <button
                  type="button"
                  className="smm-dropdown-item smm-dropdown-logout-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogoutClick?.();
                  }}
                  role="menuitem"
                >
                  <LogOut size={17} className="smm-dropdown-icon" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
