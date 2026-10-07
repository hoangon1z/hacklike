# Hacklike43

Nhập thành viên/số dư từ website cũ: xem [hướng dẫn migration CSV](deploy/LEGACY-IMPORT.md). Công cụ mặc định chỉ kiểm tra, không ghi dữ liệu.

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

### HTTPS cho hacklike43.net qua Cloudflare

- Lưu Cloudflare Origin Certificate tại `/etc/hacklike43/tls/origin.pem` và private key tại `/etc/hacklike43/tls/origin.key` trên server (không trong Git). Thư mục quyền 700, key quyền 600, owner root.
- Đặt `WEB_URL=https://hacklike43.net` và `PUBLIC_SITE_URL=https://hacklike43.net` trong `.env.production`.
- Chạy `sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml up -d --build`.
- Kiểm tra `sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec web nginx -t`.
- AWS Security Group cho phép TCP 443; DNS Cloudflare bật Proxied. Sau khi origin TLS hoạt động, bật Full (strict) và Always Use HTTPS. Không dùng Flexible.
- Origin CA không được trình duyệt tin cậy khi truy cập trực tiếp origin. Chứng chỉ cần được thay trước khi hết hạn; không tự gia hạn bằng cấu hình này.
- Mọi lệnh cập nhật production HTTPS phải dùng cả hai file Compose; không chạy `down -v` vì sẽ xóa dữ liệu database.

### Bài đăng có định dạng và ảnh

### Telegram vận hành

- Cấu hình `TELEGRAM_BOT_TOKEN` và `TELEGRAM_ADMIN_CHAT_ID` trong môi trường server (không commit token). Bot gửi cảnh báo dưới 100.000 ₫ và phục hồi sau khi số dư đạt lại ngưỡng; kiểm tra chủ động mỗi 3 phút, quy đổi USD theo tỷ giá nhà cung cấp nếu cần. Đây là ngưỡng Telegram riêng, không đổi ngưỡng trạng thái nhà cung cấp trong admin.
- Báo khi có đơn chờ tiền web cha và khi đơn cần đối soát thủ công. Không gửi cảnh báo mới cho mọi vòng retry của cùng sự cố/đơn.
- USDT chỉ báo thành công sau xác nhận trực tiếp Binance (status 1, travel rule đã xong) và giao dịch cộng ví hoàn tất; thông báo dùng tỷ giá/tiền VND đã chốt của yêu cầu nạp. Xác nhận blockchain dự phòng không đủ điều kiện thông báo. Không phát lại các khoản nhận trước lúc kích hoạt tính năng.
- Thông báo đi qua outbox có khóa và chống tạo trùng; Telegram lỗi được thử lại giãn cách, không rollback giao dịch đã cộng tiền. Telegram không hỗ trợ khóa idempotency: timeout sau khi Telegram nhận tin vẫn có thể khiến tin nhắn lặp khi retry, nhưng không cộng tiền/gửi đơn lần hai.

### Lưu trữ ảnh bài đăng

- Admin có thể định dạng nội dung qua thanh công cụ Markdown và xem trước; Home dùng cùng bộ hiển thị, không thực thi HTML/script trong bài đăng.
- Upload JPG/PNG/WebP tối đa 5 MB, ảnh được kiểm tra bằng bộ giải mã và chuyển sang WebP (tối đa 1600 px). Chỉ ADMIN/SUPER_ADMIN được upload.
- Production lưu ảnh trong volume `announcement_uploads` ở `/app/uploads`; backup volume này cùng database. Không dùng `down -v`. Local lưu trong `uploads/announcements` (có thể đổi qua `ANNOUNCEMENT_UPLOAD_DIR`).
- Ảnh bài đăng được phục vụ bằng URL công khai, không upload tài liệu nhạy cảm. Ảnh đã upload nhưng chưa lưu bài vẫn còn trong volume; hiện không tự động xóa ảnh.
