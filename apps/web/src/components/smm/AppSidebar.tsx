import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, X, Home, BadgePercent, User, CreditCard, Bell, Headphones } from 'lucide-react';
import { PlatformIcon } from '../../PlatformIcon';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  serviceMenu?: Array<{ platform: string; groups: string[] }>;
  user?: { displayName: string; email: string } | null;
  onLogoutClick?: () => void;
}

export function AppSidebar({ open, onClose, serviceMenu = [] }: SidebarProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activePlatform = params.get('platform');
  const activeGroup = params.get('group');
  const serviceRoute = ['/order', '/orders', '/schedule'].includes(location.pathname);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ general: true, account: true });
  const toggle = (key: string) => setExpanded(previous => ({ ...previous, [key]: !previous[key] }));
  useEffect(() => {
    if (serviceRoute && activePlatform) {
      setExpanded(previous => ({ ...previous, [`platform:${activePlatform}`]: true }));
    }
  }, [activePlatform, serviceRoute]);
  const section = (key: string, label: string) => (
    <button type="button" className="smm-nav-section-header" aria-expanded={!!expanded[key]} onClick={() => toggle(key)}>
      <span>{label}</span><ChevronDown size={14} className={`smm-section-arrow ${expanded[key] ? 'open' : ''}`} />
    </button>
  );
  const link = (to: string, label: string, Icon?: React.ComponentType<{ size?: number }>) => (
    <NavLink to={to} onClick={onClose} className={({ isActive }) => `smm-nav-item ${isActive ? 'active' : ''}`}>
      {Icon && <Icon size={16} />}
      <span>{label}</span>
    </NavLink>
  );
  return <>
    <aside className={`smm-dark-sidebar ${open ? 'open' : ''}`}>
      <div className="smm-sidebar-brand">
        <NavLink to="/dashboard" className="smm-brand-link" onClick={onClose}><span className="smm-brand-text">HACKLIKE43</span></NavLink>
        <button type="button" className="smm-sidebar-mobile-close" onClick={onClose} aria-label="Đóng menu"><X size={18} /></button>
      </div>
      <nav className="smm-sidebar-nav">
        {section('general', 'QUẢN LÝ CHUNG')}
        {expanded.general && <div className="smm-section-subitems">
          {link('/dashboard', 'Trang Chủ', Home)}
          {link('/pricing', 'Bảng giá & Cấp bậc', BadgePercent)}
        </div>}
        {section('account', 'TÀI KHOẢN')}
        {expanded.account && <div className="smm-section-subitems">
          {link('/profile', 'Cập nhật thông tin', User)}
          {link('/deposit', 'Nạp Tiền', CreditCard)}
          {link('/notifications', 'Nhật Ký Hoạt Động', Bell)}
          {link('/support', 'Liên Hệ Hỗ Trợ', Headphones)}
        </div>}
        <div className="smm-nav-section-label">NỀN TẢNG DỊCH VỤ</div>
        {serviceMenu.map(item => {
          const key = `platform:${item.platform}`;
          const isExpanded = !!expanded[key];
          return <div className="smm-platform-group" key={item.platform}>
            <button type="button" className={`smm-nav-parent-btn ${isExpanded ? 'expanded' : ''}`} aria-expanded={isExpanded} onClick={() => toggle(key)}>
              <div className="smm-parent-left"><PlatformIcon platform={item.platform} size={17} /><b>{item.platform}</b></div>
              <ChevronDown size={14} className={`smm-parent-chevron ${isExpanded ? 'open' : ''}`} />
            </button>
            {isExpanded && <div className="smm-platform-children"><div className="smm-subgroup-items">
              {item.groups.map(group => {
                const selected = serviceRoute && activePlatform === item.platform && activeGroup === group;
                const target = `/order?${new URLSearchParams({ platform: item.platform, group }).toString()}`;
                return <NavLink key={group} to={target} onClick={onClose} className={() => `smm-leaf-link ${selected ? 'selected' : ''}`} aria-current={selected ? 'page' : undefined}>
                  <span className="smm-leaf-dot" /><span>{group}</span>
                </NavLink>;
              })}
            </div></div>}
          </div>;
        })}
      </nav>
    </aside>
    {open && <div className="smm-sidebar-backdrop" onClick={onClose} />}
  </>;
}
