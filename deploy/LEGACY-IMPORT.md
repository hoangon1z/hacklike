# Nhập thành viên từ website cũ

CSV UTF-8 phân cách bằng `;`, đúng cột: Tên đăng nhập, Email, Chức vụ, SDT, Số dư, Tổng nạp, Ngày tạo. Ngày tạo được hiểu theo giờ Việt Nam. Chỉ nhập Thành Viên thành CUSTOMER. Không nhập admin, không tạo lịch sử giao dịch giả.

Trước khi thực hiện, dừng ghi dữ liệu trên site cũ để tránh khách tiếp tục tiêu số dư đã xuất; backup database mới. File CSV không chứa đơn đang chạy hay tiền đang giữ: cần đối soát riêng, không tự suy ra từ tổng nạp. Site mới là database riêng, không tự nhập dữ liệu từ máy local.

1. Pull code, deploy với hai file Compose production + TLS để chạy migration.
2. Backup: `sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > legacy-import-backup.sql`. Kiểm tra exit code và file không trống; lưu backup an toàn ngoài máy chủ.
3. Upload CSV riêng tới `/home/ubuntu/export_user.csv`, chmod 600. Không commit CSV, backup, mật khẩu hoặc key.
4. Copy vào container API: `sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml cp /home/ubuntu/export_user.csv api:/tmp/export_user.csv`. Đặt quyền: `sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec -u root api sh -c 'chown node:node /tmp/export_user.csv && chmod 600 /tmp/export_user.csv'`.
5. Dry-run: `sudo docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec -T api node apps/api/scripts/import-legacy-users.cjs --file /tmp/export_user.csv`. Không ghi dữ liệu. Báo số tài khoản mới/trùng/đã nhập, tổng số dư và tổng nạp lịch sử; không in mật khẩu hoặc email.
6. Soát báo cáo; lấy `sourceHash` đúng file. Nhập mật khẩu ban đầu bằng Bash `read -r -s -p 'Initial password: ' LEGACY_INITIAL_PASSWORD`, `export LEGACY_INITIAL_PASSWORD`. Khi dùng sudo, truyền đúng biến: `sudo --preserve-env=LEGACY_INITIAL_PASSWORD docker compose --env-file .env.production -f docker-compose.production.yml -f docker-compose.tls.yml exec -T -e LEGACY_INITIAL_PASSWORD api node apps/api/scripts/import-legacy-users.cjs --file /tmp/export_user.csv --apply --expected-sha256 HASH`. Sau đó `unset LEGACY_INITIAL_PASSWORD`. Không ghi mật khẩu trong source hay lệnh có lịch sử shell.
7. Nếu có tài khoản đã tồn tại: mặc định từ chối apply; chỉ dùng `--skip-existing` sau khi duyệt để giữ nguyên những tài khoản này, không cộng số dư/đổi password. Bản ghi đã nhập cùng snapshot bị bỏ qua; snapshot đổi phải đối soát thủ công.

Apply dùng một transaction Serializable với khóa chung admin-users, unique email/snapshot và unique ledger key. Nếu lỗi rollback toàn batch. Số dư đầu kỳ dùng OPENING_BALANCE, không DEPOSIT; tổng nạp cũ lưu riêng trong LegacyUserImport, cộng vào tổng nạp trên hồ sơ/dashboard khách, không tính thành doanh thu/nạp mới trong báo cáo kỳ hiện tại. Username/SDT/ngày tạo cũ lưu trong snapshot. Không khôi phục lịch sử đơn hoặc thanh toán từ CSV này.

Mỗi mật khẩu được bcrypt với salt riêng; khách phải đổi mật khẩu trước khi truy cập ví, đặt đơn hoặc nạp. Sau đổi mật khẩu tất cả session cũ bị thu hồi. Mật khẩu chung vẫn có rủi ro: ai biết email và mật khẩu ban đầu có thể đăng nhập đầu tiên và đổi trước chủ tài khoản. Chỉ mở truy cập sau khi đã thông báo khách qua kênh xác thực; ưu tiên mật khẩu riêng hoặc quy trình xác minh email khi có thể.

Sau đối soát, xóa đúng `/tmp/export_user.csv` trong container; giữ bản CSV nguồn và backup trong nơi bảo mật, ngoài Git. Khi recreate container phải copy CSV lại nếu cần chạy dry-run, không cần nhập lại số dư.
