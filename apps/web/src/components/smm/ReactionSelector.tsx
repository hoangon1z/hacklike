import React from 'react';
import { ReactionCode, REACTIONS } from '../../serviceReactions';

interface ReactionSelectorProps {
  availableCodes?: ReactionCode[];
  selectedCode?: string | null;
  onSelect: (code: ReactionCode) => void;
  disabled?: boolean;
}

// Visual icons matching Facebook reactions with exact circular badge aesthetics
const FB_REACTION_SVGS: Record<string, React.ReactNode> = {
  like: (
    <div className="smm-fb-icon smm-fb-like" title="Thích">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#1877F2" />
        <path
          d="M10 26.5V17.8c0-.4.3-.7.7-.7h2.7c.4 0 .7.3.7.7v8.7c0 .4-.3.7-.7.7h-2.7c-.4 0-.7-.3-.7-.7zm16.5-6.6c0-.9-.5-1.7-1.3-2.1.4-.4.7-1 .7-1.7 0-1-.6-1.8-1.5-2.1.2-.4.3-.8.3-1.3 0-1.2-1-2.2-2.3-2.2h-4.3c.3-1 .8-2.6.8-3.7 0-1.6-.7-2.8-2.1-2.8-.7 0-1.3.4-1.6 1-.3.7-.4 1.7-.4 2.8 0 2.2-1.3 4.2-2.8 5.7v11.7c1.7.5 4 .9 6.2.9h5.1c1.3 0 2.4-.9 2.7-2.1.3-.3.6-.9.6-1.5.3-.4.5-1 .5-1.7.1-.3.1-.6.1-.9z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  ),
  love: (
    <div className="smm-fb-icon smm-fb-love" title="Yêu thích">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#F33E58" />
        <path
          d="M18 28.5s-8.5-5.3-10.7-9.8c-1.8-3.7.3-7.7 4.1-7.7 2.5 0 4.8 1.8 6.6 3.6 1.8-1.8 4.1-3.6 6.6-3.6 3.8 0 5.9 4 4.1 7.7-2.2 4.5-10.7 9.8-10.7 9.8z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  ),
  care: (
    <div className="smm-fb-icon smm-fb-care" title="Thương thương">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#F7B125" />
        <circle cx="13" cy="15" r="2.2" fill="#4B4B4B" />
        <circle cx="23" cy="15" r="2.2" fill="#4B4B4B" />
        <path
          d="M14 20.5c1 1.5 2.5 2.2 4 2.2s3-.7 4-2.2"
          stroke="#4B4B4B"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M18 29s-5.5-3.3-7-6.2c-1.2-2.3.2-4.8 2.6-4.8 1.6 0 3 1.1 4.4 2.3 1.4-1.2 2.8-2.3 4.4-2.3 2.4 0 3.8 2.5 2.6 4.8-1.5 2.9-7 6.2-7 6.2z"
          fill="#F33E58"
        />
      </svg>
    </div>
  ),
  haha: (
    <div className="smm-fb-icon smm-fb-haha" title="Haha">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#F7B125" />
        <path
          d="M10 14.5l3.5 1.5-3.5 1.5M26 14.5l-3.5 1.5 3.5 1.5"
          stroke="#4B4B4B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M11 20.5c0 4.5 3.1 7.5 7 7.5s7-3 7-7.5H11z"
          fill="#4B4B4B"
        />
        <path
          d="M13 20.5c0 2 2.2 3.5 5 3.5s5-1.5 5-3.5H13z"
          fill="#EB5757"
        />
      </svg>
    </div>
  ),
  wow: (
    <div className="smm-fb-icon smm-fb-wow" title="Wow">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#F7B125" />
        <circle cx="12.5" cy="14" r="2.5" fill="#4B4B4B" />
        <circle cx="23.5" cy="14" r="2.5" fill="#4B4B4B" />
        <path
          d="M11 9.5c.8-.8 2.2-.8 3 0M22 9.5c.8-.8 2.2-.8 3 0"
          stroke="#4B4B4B"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="18" cy="23.5" rx="4.5" ry="5.5" fill="#4B4B4B" />
      </svg>
    </div>
  ),
  sad: (
    <div className="smm-fb-icon smm-fb-sad" title="Buồn">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#F7B125" />
        <circle cx="12.5" cy="16" r="2" fill="#4B4B4B" />
        <circle cx="23.5" cy="16" r="2" fill="#4B4B4B" />
        <path
          d="M14 24c1-1.2 2.5-1.8 4-1.8s3 .6 4 1.8"
          stroke="#4B4B4B"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M24.5 19c-1 1.5-1.5 3-1.5 4 0 1.1.9 2 2 2s2-.9 2-2c0-1-.5-2.5-1.5-4h-1z"
          fill="#2D9CDB"
        />
      </svg>
    </div>
  ),
  angry: (
    <div className="smm-fb-icon smm-fb-angry" title="Phẫn nộ">
      <svg viewBox="0 0 36 36" width="46" height="46">
        <circle cx="18" cy="18" r="18" fill="#EA5A47" />
        <path
          d="M11 12l4 3M25 12l-4 3"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="13.5" cy="17" r="2" fill="#FFFFFF" />
        <circle cx="22.5" cy="17" r="2" fill="#FFFFFF" />
        <path
          d="M13 25c1.5-1.8 3.2-2.5 5-2.5s3.5.7 5 2.5"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  ),
};

export function ReactionSelector({
  availableCodes,
  selectedCode,
  onSelect,
  disabled = false,
}: ReactionSelectorProps) {
  // If no reaction codes are available for this service, do NOT show reaction selector
  if (!availableCodes || availableCodes.length === 0) {
    return null;
  }

  const codesToShow = availableCodes;

  return (
    <div className="smm-reactions-section">
      <label className="smm-form-label">Chọn loại cảm xúc:</label>
      <div className="smm-reaction-row" role="radiogroup" aria-label="Chọn loại cảm xúc">
        {codesToShow.map((code) => {
          const isSelected = selectedCode === code;
          return (
            <button
              type="button"
              key={code}
              disabled={disabled}
              className={`smm-reaction-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(code)}
              aria-checked={isSelected}
              role="radio"
            >
              <div className="smm-reaction-icon-wrap">
                {FB_REACTION_SVGS[code] || <span>👍</span>}
              </div>
              <div className={`smm-reaction-checkbox ${isSelected ? 'checked' : ''}`}>
                {isSelected && (
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
