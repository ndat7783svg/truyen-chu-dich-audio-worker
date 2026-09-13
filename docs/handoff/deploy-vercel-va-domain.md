# Deploy Vercel + mua domain Namecheap (2026-09-13)

## Quy trình đã chạy thành công
1. Commit sạch code đang chờ trước khi deploy.
2. `npx vercel login` → in ra link `https://vercel.com/oauth/device?user_code=...` — **user phải tự
   mở link xác nhận**, Claude không tự xác thực OAuth thay được. Lưu ý: mỗi lần gọi lại `vercel
   login` sẽ sinh **user_code MỚI** — nếu lệnh đầu bị timeout/huỷ, phải lấy code từ lần chạy sau
   cùng, không dùng lại code cũ.
3. `npx vercel link --yes --project <ten-hop-le>` — tên thư mục có dấu tiếng Việt/khoảng trắng nên
   Vercel không tự đoán được tên project hợp lệ (chữ thường, không dấu, không khoảng trắng) → phải
   truyền `--project` tường minh.
4. Thêm biến môi trường: `npx vercel env add <KEY> production --value "<value>" --yes`.
   - **Bug đã gặp**: chạy trong vòng lặp `while read key value; do npx vercel env add ...; done <
     file` mà không cô lập stdin → `vercel env add` tự đọc luôn phần stdin còn lại của vòng lặp,
     làm sai lệch/mất giá trị các biến sau. Cách sửa: đọc file qua fd riêng (`done 3< file`,
     `read ... <&3`) và bắt buộc thêm `</dev/null` cho lệnh `vercel env add` để nó không đụng vào
     stdin của loop.
   - Biến dạng `NEXT_PUBLIC_*` chứa giá trị giống credential (JWT anon key) sẽ bị Vercel từ chối nếu
     không khai rõ `--type`: phải thêm `--type config` (vì đây là **cố ý public**, do thiết kế bảo
     mật của Supabase dựa vào RLS chứ không phải giấu anon key).
   - `vercel env ls` hiển thị giá trị Config dạng chuỗi mã hoá `eyJ2IjoidjIiLCJjIj…` — **đây KHÔNG
     phải giá trị thật**, chỉ là token hiển thị của CLI. Muốn xác nhận giá trị thật, dùng
     `vercel env pull <file> --environment production --yes` rồi đọc file (Secret sẽ hiện
     `[SENSITIVE]`, Config hiện đúng giá trị thật).
5. Deploy: `npx vercel --prod --yes`. Ra 2 URL: preview-style
   (`truyen-chu-dich-<hash>-asuo-team.vercel.app`) và alias chính thức
   (`truyen-chu-dich.vercel.app`) — dùng alias để test/chia sẻ.
6. Mua domain `truyenchudich.site` trên Namecheap ($0.98/năm khuyến mãi) — **Claude không tự thao
   tác mua/thanh toán được** (quy tắc an toàn: không nhập thông tin thẻ thay user), chỉ hướng dẫn
   từng bước qua chat, user tự bấm Confirm Order + Pay Now. Nhắc user tắt Auto-Renew nếu chỉ muốn
   dùng đúng 1 năm không bị tự động trừ tiền năm sau.
7. Gắn domain vào Vercel: `npx vercel domains add <domain>` (thêm vào team) rồi
   `npx vercel domains add <domain> <project-name>` (gắn vào đúng project) — làm cả cho domain gốc
   và `www.<domain>`.
8. Trỏ DNS tại Namecheap (không cần đổi nameserver, chỉ cần sửa Advanced DNS):
   - `A` record, Host `@`, Value `76.76.21.21` (IP chuẩn của Vercel, lấy từ output
     `vercel domains inspect <domain>`).
   - `CNAME` record, Host `www`, Value `cname.vercel-dns.com`.
   - Phải **xoá** 2 bản ghi mặc định Namecheap tạo sẵn khi mua domain mới (CNAME `www →
     parkingpage.namecheap.com`, URL Redirect `@ → http://www.<domain>...`) vì trùng loại bản ghi
     gây xung đột — nếu Namecheap báo lỗi "Failed to retrieve the record!" khi xoá, chỉ cần F5 tải
     lại trang Advanced DNS rồi xoá lại (lỗi UI tạm thời hay gặp ngay sau khi vừa mua domain).
9. Kiểm chứng: `npx vercel domains inspect <domain>` hết cảnh báo "not configured properly" là DNS
   đã nhận đúng (không cần đợi email xác nhận).

## Bug quan trọng: WARP chặn IP `76.76.21.21` (IP chuẩn của Vercel)
Sau khi DNS đã đúng hoàn toàn, `curl` từ máy user (Git Bash) tới domain mới bị **connection timeout**
(cả HTTP lẫn HTTPS) dù `nslookup` qua Google DNS (`8.8.8.8`) trả về đúng IP. Domain **vẫn chạy bình
thường** khi test qua trình duyệt tự động (network khác) và qua trình duyệt thật của user sau khi
kiểm tra lại. Kết luận: đây là kiểu sự cố **WARP chặn/định tuyến sai 1 IP cụ thể** giống hệt sự cố
từng gặp với domain Supabase (xem `moi-truong-va-cong-cu.md`) — không phải lỗi cấu hình DNS/Vercel.
Bài học: khi `curl`/công cụ dòng lệnh trên máy user không kết nối được tới 1 domain/IP cụ thể dù DNS
đúng, **luôn nghi WARP trước**, xác minh lại bằng cách thử qua trình duyệt thật hoặc mạng khác trước
khi kết luận domain/deploy có vấn đề.
