import React from 'react';

interface SelectedServiceInfoProps {
  id: string | number;
  description?: string | null;
  min: number;
  max: number;
}

function formatLimit(val: number): string {
  if (val >= 1000) {
    const k = val / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1).replace('.', ',')}k`;
  }
  return val.toLocaleString('vi-VN');
}

export function SelectedServiceInfo({
  id,
  description,
  min,
  max,
}: SelectedServiceInfoProps) {
  // Parse clean lines from real backend description (stripping HTML/scripts)
  const cleanDesc = description
    ? description
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .trim()
    : null;

  const descLines = cleanDesc
    ? cleanDesc
        .split(/\r?\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="smm-selected-info-panel">
      <div className="smm-selected-info-id">ID: {id}</div>
      {descLines.length > 0 && (
        <div className="smm-selected-info-bullets">
          {descLines.map((line, idx) => (
            <p key={idx} className="smm-info-line">
              <span className="smm-check-mark">✓</span> {line}
            </p>
          ))}
        </div>
      )}
      <div className="smm-selected-info-limits">
        Tối thiểu/Tối đa: {formatLimit(min)}/{formatLimit(max)}
      </div>
    </div>
  );
}
