# SePay cho Hacklike43

Hiện tại yêu cầu nạp mới chỉ sử dụng **MBBank**. KienlongBank có
`depositsEnabled: false` trong `SEPAY_BANK_ACCOUNTS`: không xuất hiện trong
danh sách ngân hàng và không tạo được yêu cầu mới, nhưng vẫn nhận/đối soát
giao dịch cho yêu cầu cũ. Giữ webhook KienlongBank để xử lý các khoản đang chuyển.
Với một ngân hàng khả dụng, trang nạp tự chọn MBBank và ẩn phần chọn ngân hàng.

Backend nhận webhook tại `https://hacklike43.net/api/payments/sepay/webhook`.
API access token dùng để đọc/đối soát giao dịch. `SEPAY_WEBHOOK_SECRET` là một khóa
riêng, dùng để xác thực SePay khi gửi webhook tới website.

## Cấu hình đã chuẩn bị trên server

- `.env.production`: `SEPAY_API_TOKEN`, `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_ACCOUNTS`.
- Hai tài khoản nhận tiền được lấy trực tiếp từ API SePay: KienLongBank và MBBank.
- Mỗi yêu cầu nạp lưu thông tin ngân hàng đã chọn. Webhook chỉ tự cộng khi đúng tài
  khoản, ngân hàng, mã nạp và giao dịch tiền vào. ID giao dịch chống cộng trùng.
- Nạp thiếu được cộng theo số thực nhận; nạp thừa chỉ tự cộng tối đa số tiền yêu cầu,
  phần dư cần quản trị đối soát theo chính sách hiện có.

## Tài khoản ảo (VA)

KienlongBank API chỉ thông báo giao dịch nhận qua VA. Trong JSON
`SEPAY_BANK_ACCOUNTS`, giữ `accountNumber` là tài khoản chính và thêm
`virtualAccountNumber` là số VA đang hoạt động trong SePay. QR và số tài khoản
hiển thị cho người nạp dùng VA; webhook phải khớp cả `accountNumber` (chính),
`subAccount` (VA), ngân hàng và mã nạp. API đối soát dùng `sub_account`.
MBBank cũng dùng `virtualAccountNumber` khi nhận qua VA; VA có thể gồm cả chữ và số.
Chỉ khi không cấu hình VA thì QR mới dùng tài khoản chính.

Chọn **Tất cả VA** hoặc chọn đúng VA này trong webhook KienlongBank.
Yêu cầu nạp mới lưu VA trong snapshot; không sửa thông tin của yêu cầu cũ.
Sau khi cập nhật cấu hình, tải lại trang nạp để lấy QR mới. Khoản đã chuyển thẳng
vào tài khoản chính có thể không được SePay ghi nhận; cần đối soát riêng với chứng
từ ngân hàng, không gửi webhook giả để cộng tiền.

Tài liệu: https://developer.sepay.vn/vi/sepay-webhooks/tai-khoan-ngan-hang

## Tạo webhook trong SePay

Tạo **hai webhook**, mỗi webhook gắn một tài khoản ngân hàng:

| Trường | Giá trị |
|---|---|
| Tên | Hacklike43 KienLongBank / Hacklike43 MBBank |
| Sự kiện | Có tiền vào |
| URL | `https://hacklike43.net/api/payments/sepay/webhook` |
| Tài khoản | Chọn đúng KienLongBank hoặc MBBank tương ứng |
| Kiểu xác thực | API Key |
| Content-Type | JSON |
| API Key | Giá trị `SEPAY_WEBHOOK_SECRET` trên server |
| Trạng thái | Hoạt động |

Lấy giá trị khóa trong terminal SSH, tại thư mục project:

```sh
sed -n 's/^SEPAY_WEBHOOK_SECRET=//p' .env.production
```

Sao chép trực tiếp giá trị vào SePay. Không thêm chữ `Apikey`, không dùng
`SEPAY_API_TOKEN` thay cho webhook secret, không gửi khóa lên chat hoặc Git.
SePay tự tạo header `Authorization: Apikey <khóa>`.

Không bật bộ lọc bắt buộc có mã thanh toán cho lần cài đặt đầu tiên: website tự tìm
chuỗi `SVN` + 10 ký tự hex trong nội dung chuyển khoản. Nếu dùng bộ lọc, cần bảo đảm
SePay nhận đúng định dạng này. Không thêm webhook trùng cho cùng tài khoản/website.

Dùng chức năng Gửi thử và xem nhật ký: phản hồi hợp lệ là HTTP 200/201 cùng
`{"success":true}`. Gửi thử không chứng minh đã cộng tiền cho một yêu cầu nạp thật.
Chỉ bật **Admin → Cấu hình → Banking** sau khi cả hai webhook đã cấu hình đúng.
Sau đó tạo yêu cầu nạp và chuyển thử một khoản nhỏ theo đúng QR/mã nạp để kiểm tra
từ đầu đến cuối. Không dùng webhook giả khớp mã nạp thật trên production.

## Kiểm tra code

`apps/api/scripts/test-sepay.cjs` tạo database test riêng, chạy migration và kiểm tra
webhook/cộng tiền/chống trùng, rồi xóa database test; không tạo số dư giả ở production.

Tài liệu: [Webhook SePay](https://docs.sepay.vn/tich-hop-webhooks.html),
[API tài khoản ngân hàng](https://docs.sepay.vn/api-tai-khoan-ngan-hang.html).
