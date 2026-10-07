import React from 'react';
import { BookOpen, Headphones, Info } from 'lucide-react';

interface NoticeCardProps {
  serviceDescription?: string | null;
  orderSupport?: {
    telegram?: unknown;
    fanpage?: unknown;
  } | null;
}

export function NoticeCard({ serviceDescription, orderSupport }: NoticeCardProps) {
  const telegram = typeof orderSupport?.telegram === 'string' && orderSupport.telegram ? orderSupport.telegram : null;
  const fanpage = typeof orderSupport?.fanpage === 'string' && orderSupport.fanpage ? orderSupport.fanpage : null;
  return (
    <div className="smm-card smm-side-card">
      <div className="smm-side-card-header">
        <div className="smm-side-card-title">
          <span className="smm-icon-circle blue">
            <BookOpen size={15} />
          </span>
          <b>Lưu ý & Hướng dẫn</b>
        </div>
      </div>
      <div className="smm-notice-body">
        {serviceDescription && (
          <div className="smm-notice-section">
            <h4>Lưu ý dịch vụ đã chọn</h4>
            <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
              {serviceDescription}
            </p>
          </div>
        )}

        <div className="smm-notice-section">
          <h4>Đặt đơn chính xác</h4>
          <ol className="smm-link-steps">
            <li>Mở đúng bài viết, video hoặc tài khoản cần tăng tương tác.</li>
            <li>Sao chép đường dẫn đầy đủ rồi dán vào ô bên cạnh.</li>
            <li>Không tạo nhiều đơn giống nhau khi đơn cũ còn đang chạy.</li>
            <li>Không thay đổi quyền riêng tư hoặc xóa nội dung trong lúc chạy.</li>
          </ol>
        </div>

        {(telegram || fanpage) && (
          <div className="smm-notice-section">
            <h4>Hỗ trợ trực tuyến</h4>
            <p>Liên hệ đội ngũ CSKH nếu bạn cần hỗ trợ kiểm tra đường dẫn hoặc đơn hàng:</p>
            <div className="smm-support-links-row" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {telegram && (
                <a
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="smm-support-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#0284C7',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  <Headphones size={13} /> Telegram
                </a>
              )}
              {fanpage && (
                <a
                  href={fanpage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="smm-support-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#1D4ED8',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  <Headphones size={13} /> Fanpage
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
