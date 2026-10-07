import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';

interface FloatContactWidgetProps {
  support?: {
    telegram?: unknown;
    fanpage?: unknown;
  } | null;
}

export function FloatContactWidget({ support }: FloatContactWidgetProps) {
  const fanpage = typeof support?.fanpage === 'string' && support.fanpage ? support.fanpage : null;
  const telegram = typeof support?.telegram === 'string' && support.telegram ? support.telegram : null;
  const fanpageUrl = fanpage || 'https://m.me';
  const telegramUrl = telegram || 'https://t.me';

  return (
    <aside className="smm-float-contact-dock" aria-label="Kênh hỗ trợ trực tuyến">
      {/* Telegram Button */}
      {telegram ? (
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="smm-float-btn telegram"
          title="Chat qua Telegram"
          style={{ background: '#0284C7' }}
        >
          <span className="smm-float-zalo-text" style={{ fontSize: '11px' }}>Tele</span>
        </a>
      ) : (
        <a
          href="https://zalo.me"
          target="_blank"
          rel="noopener noreferrer"
          className="smm-float-btn zalo"
          title="Chat qua Zalo"
        >
          <span className="smm-float-zalo-text">Zalo</span>
        </a>
      )}

      {/* Fanpage / Messenger Button */}
      <a
        href={fanpageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="smm-float-btn messenger"
        title="Chat qua Fanpage / Messenger"
      >
        <svg viewBox="0 0 28 28" width="20" height="20" fill="currentColor">
          <path d="M14 2C7.4 2 2 7.1 2 13.4c0 3.6 1.7 6.9 4.4 9v4.6l4.4-2.4c1 .3 2.1.4 3.2.4 6.6 0 12-5.1 12-11.4C26 7.1 20.6 2 14 2zm1.2 15.3l-3.1-3.3-6.1 3.3 6.7-7.1 3.2 3.3 6-3.3-6.7 7.1z" />
        </svg>
      </a>

      {/* Phone Button */}
      <a
        href="tel:0900000000"
        className="smm-float-btn phone"
        title="Gọi hotline hỗ trợ"
      >
        <Phone size={18} />
      </a>

      {/* Chat Support Button */}
      <button
        type="button"
        className="smm-float-btn livechat"
        title="Hỗ trợ trực tuyến"
        aria-label="Mở cửa sổ chat"
      >
        <MessageCircle size={18} />
      </button>
    </aside>
  );
}
