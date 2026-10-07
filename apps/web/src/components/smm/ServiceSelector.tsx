import React from 'react';
import { formatUnitVND } from '../../utils/formatVND';
import { SelectedServiceInfo } from './SelectedServiceInfo';

export interface ServiceItem {
  id: string | number;
  name: string;
  providerServiceId?: string;
  price: number; // sellingRate per 1000
  min: number;
  max: number;
  providerDescription?: string | null;
  enabled?: boolean;
}

interface ServiceSelectorProps {
  services: ServiceItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  serviceDescription?: string | null;
  loading?: boolean;
}

export function ServiceSelector({
  services,
  selectedId,
  onSelect,
  serviceDescription,
  loading = false,
}: ServiceSelectorProps) {
  if (loading) {
    return (
      <div className="smm-service-skeleton" role="status" aria-label="Đang tải danh sách server">
        <div className="smm-service-skeleton-row" />
        <div className="smm-service-skeleton-row" />
        <div className="smm-service-skeleton-row" />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="smm-empty-notice">
        Không có dịch vụ nào đang mở trong danh mục này.
      </div>
    );
  }

  return (
    <div className="smm-service-list" role="radiogroup" aria-label="Chọn server">
      {services.map((item) => {
        const isSelected = String(item.id) === selectedId;
        const cleanName = item.name.replace(/\s*\|\s*$/, '').trim();

        const isEnabled = item.enabled !== false;

        return (
          <div key={item.id} className="smm-service-entry">
            <div
              className={`smm-service-row ${isSelected ? 'selected' : ''} ${!isEnabled ? 'disabled' : ''}`}
              onClick={() => onSelect(String(item.id))}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={!isEnabled}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onSelect(String(item.id));
                }
              }}
            >
              <div className="smm-service-radio-wrap">
                <div className={`smm-radio-dot ${isSelected ? 'checked' : ''}`} />
              </div>
              <div className="smm-service-name">
                {cleanName}
              </div>
              <div className="smm-service-price">
                {formatUnitVND(item.price)}
              </div>
              <div className={`smm-service-status-badge ${isEnabled ? '' : 'maintenance'}`}>
                {isEnabled ? 'Hoạt động' : 'Bảo trì'}
              </div>
            </div>

            {isSelected && (
              <SelectedServiceInfo
                id={item.providerServiceId || item.id}
                description={serviceDescription || item.providerDescription}
                min={item.min}
                max={item.max}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
