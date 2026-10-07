import React from 'react';
import { DollarSign, CreditCard, CheckCircle2, ShieldAlert, ChevronDown } from 'lucide-react';
import { formatVND } from '../../utils/formatVND';

interface AccountSummaryProps {
  user: {
    displayName: string;
    email: string;
    wallet?: {
      balance: string | number;
      reserved: string | number;
    } | null;
  } | null;
  totalDeposited?: number | null;
  loadingDeposited?: boolean;
}

export function AccountSummary({
  user,
  totalDeposited,
  loadingDeposited = false,
}: AccountSummaryProps) {
  const balance = user?.wallet
    ? Number(user.wallet.balance) - Number(user.wallet.reserved)
    : 0;

  const initials = user?.displayName
    ? user.displayName
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((x) => x[0])
        .join('')
        .toUpperCase()
    : 'U';

  const userLoading = !user;

  return (
    <div className="smm-account-summary-wrap">
      {/* 3 Horizontal Cards */}
      <div className="smm-summary-cards">
        {/* Profile Card */}
        <div className="smm-summary-card smm-profile-card">
          <div className="smm-avatar-circle">
            <span className="smm-avatar-text">{initials}</span>
          </div>
          <div className="smm-profile-info">
            <div className="smm-profile-name-row">
              {userLoading ? (
                <span className="smm-skeleton-line medium" />
              ) : (
                <span className="smm-profile-name">{user.displayName}</span>
              )}
              <CheckCircle2 size={16} className="smm-verified-badge" />
            </div>
            <div className="smm-profile-email-row">
              {userLoading ? (
                <span className="smm-skeleton-line short" />
              ) : (
                <span className="smm-profile-email">{user.email}</span>
              )}
              <ShieldAlert size={14} className="smm-email-shield" />
            </div>
          </div>
        </div>

        {/* Số dư Card */}
        <div className="smm-summary-card smm-balance-card">
          <div className="smm-card-icon-box">
            <DollarSign size={20} className="smm-blue-icon" />
          </div>
          <div className="smm-card-metric-info">
            <small className="smm-metric-label">Số dư</small>
            <div className="smm-metric-value-row">
              {userLoading ? (
                <span className="smm-skeleton-line tall" />
              ) : (
                <strong className="smm-metric-value">{formatVND(balance)}</strong>
              )}
              <div className="smm-currency-pill">
                <span>VN VND</span>
                <ChevronDown size={11} />
              </div>
            </div>
          </div>
        </div>

        {/* Tổng nạp Card */}
        <div className="smm-summary-card smm-deposit-card">
          <div className="smm-card-icon-box">
            <CreditCard size={20} className="smm-blue-icon" />
          </div>
          <div className="smm-card-metric-info">
            <small className="smm-metric-label">Tổng nạp tháng</small>
            {loadingDeposited || totalDeposited === undefined || totalDeposited === null ? (
              <span className="smm-skeleton-line tall" />
            ) : (
              <strong className="smm-metric-value">{formatVND(totalDeposited)}</strong>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
