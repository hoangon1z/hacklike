# Thử API SubVietnam qua mạng localhost

Chỉ kiểm tra `balance`, không tạo đơn, không cập nhật trạng thái production.
Relay cố định endpoint SubVietnam, yêu cầu Bearer token và chỉ nghe localhost.

## Trên máy cá nhân đang gọi API thành công

1. Chép thư mục này từ server về máy cá nhân, **bao gồm file ẩn `.env.relay` đã được tạo riêng cho lần thử này**. File đó chứa token dùng chung với server, không gửi lên chat hoặc Git.
2. Cài Node.js 22 và [cloudflared](https://developers.cloudflare.com/tunnel/downloads/).
3. Mở `.env.relay` bằng trình soạn thảo; điền API key đang chạy được trên localhost vào `SMM_PROVIDER_API_KEY`. Giữ nguyên `RELAY_TOKEN`.
4. Mở terminal tại thư mục này, chạy:

```sh
node --env-file=.env.relay server.mjs
```

5. Mở terminal thứ hai tại cùng thư mục, kiểm tra trực tiếp trước:

```sh
node --env-file=.env.relay check.mjs http://127.0.0.1:8787
```

Kết quả mong đợi: `http: 200`, `balanceReceived: true`. Nếu thất bại, dừng tại đây để đối chiếu với chương trình localhost đang chạy được.

6. Nếu bước trên thành công, chạy trong terminal thứ hai:

```sh
cloudflared tunnel --url http://127.0.0.1:8787
```

Gửi URL `https://...trycloudflare.com` được in ra để kiểm tra từ VPS. Giữ cả hai terminal mở. Chỉ chia sẻ URL, không chia sẻ API key/token. Không bật xác minh email cho bài thử machine-to-machine; relay đã yêu cầu token.

## Kiểm tra từ VPS

Từ thư mục project, thay URL bên dưới bằng URL thực tế:

```sh
sudo docker run --rm --network host \
  -v "$PWD/deploy/provider-relay:/relay:ro" -w /relay \
  --entrypoint node hacklike-api \
  --env-file=.env.relay check.mjs https://YOUR-TUNNEL.trycloudflare.com
```

Kiểm tra này chỉ đọc số dư; không sửa cấu hình API production. Dừng hai tiến trình trên máy cá nhân bằng Ctrl+C sau khi thử xong.

[Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) dành cho thử nghiệm, URL thay đổi khi khởi động lại và không có cam kết uptime. Muốn vận hành lâu dài cần máy luôn online và một phương án triển khai ổn định riêng.
