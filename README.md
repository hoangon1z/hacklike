# Hacklike43

Nền tảng SMM reseller production gồm React, NestJS, PostgreSQL, Redis và BullMQ.

## Chạy local

1. Sao chép `.env.example` thành `.env` và điền secret riêng.
2. Chạy `docker compose up -d`.
3. Chạy `npm install` và `npm run db:generate`.
4. Chạy `npm run db:migrate`.
5. Chạy `npm run dev`.

Frontend: `http://localhost:5173` · API: `http://localhost:4000/api`

Không đưa API key hoặc secret vào Git. API key nhà cung cấp đã xuất hiện trong hội thoại phải được thu hồi trước khi dùng production.

## Cấu hình vận hành

- Nhà cung cấp: đặt `SMM_PROVIDER_API_KEY` trong `.env`, sau đó vào **Admin → Dịch vụ & giá → Đồng bộ giá**.
- Hỗ trợ, tỷ giá USDT, biên an toàn, ngưỡng cảnh báo và bật/tắt cổng nạp được lưu tại **Admin → Cấu hình**.
- SePay: cấu hình webhook tới `https://ten-mien-cua-ban/api/payments/sepay/webhook`, chọn xác thực API Key và đặt cùng giá trị trong `SEPAY_WEBHOOK_SECRET`.
- Binance: API key chỉ cần quyền đọc ví/deposit history, không cấp quyền giao dịch hoặc rút tiền. Khai báo địa chỉ nạp USDT của tài khoản Binance cho cả TRC20 và BEP20.
- Telegram cảnh báo vận hành dùng `TELEGRAM_BOT_TOKEN` và `TELEGRAM_ADMIN_CHAT_ID`; đây không phải liên kết hỗ trợ hiển thị cho khách.

## Chạy production bằng Docker

1. Sao chép `.env.production.example` thành `.env.production` và thay toàn bộ mật khẩu/secret mẫu.
2. Trỏ `WEB_URL` về domain HTTPS thật.
3. Chạy `docker compose -f docker-compose.production.yml up -d --build`.
4. API tự chạy `prisma migrate deploy`; React được phục vụ qua Nginx và `/api` được reverse proxy nội bộ.
5. Kiểm tra `https://ten-mien-cua-ban/api/health` trước khi mở traffic.

PostgreSQL và Redis không mở cổng công khai trong compose production. Hãy đặt reverse proxy TLS hoặc CDN phía trước cổng 80 của dịch vụ web.
