# Thiết kế: Giới hạn tốc độ request để chống bot cào quá tải (rate limiting)

Ngày: 2026-09-14
Trạng thái: đã duyệt qua brainstorming, chờ viết plan implementation.

## Bối cảnh / mục tiêu
Tối 2026-09-13, log Vercel cho thấy 1 client cào ~60 chương liên tiếp của 1 bộ truyện trong vòng
~3 giây (nhịp độ không thể là người đọc thật). Đúng lúc đó có khách thật đang đọc bị lỗi 404 giả
(đã sửa riêng ở commit `4559400` — nguyên nhân là code không check `error` từ Supabase, coi mọi lỗi
tạm thời là "không tìm thấy") và site load rất chậm (vài giây đến chục giây mỗi lần chuyển chương).

**Mục tiêu duy nhất của thiết kế này: giảm tải để site ổn định** — ngăn 1 client gửi quá nhiều
request/giây làm nghẽn Supabase/Vercel. Không nhắm tới chống ăn cắp nội dung (việc đó để riêng đợt
"chặn copy nâng cao" bàn sau, theo `NEXT_SESSION.md`).

**Ràng buộc cứng đã có từ trước** (`CLAUDE.md`/`NEXT_SESSION.md`): không được chặn crawl thật của
Googlebot/Bing vì cần cho SEO (kênh có khách miễn phí lớn nhất của 1 trang đọc truyện).

## Phạm vi áp dụng
Chỉ áp dụng cho path bắt đầu bằng `/truyen/` — bao trùm cả trang truyện (`/truyen/[slug]`) lẫn
trang đọc chương (`/truyen/[slug]/chuong/[so]`), đúng nơi bị cào nặng nhất (mỗi request đều gọi
Supabase). Không đụng trang chủ, tìm kiếm, trang thể loại, trang tài khoản.

## Kiến trúc

Chặn ở `middleware.ts` (đã tồn tại, chạy trước mọi request, hiện đang lo refresh session Supabase +
cấp cookie `khach_id`). Thêm 1 nhánh xử lý mới, chỉ chạy khi `pathname` khớp phạm vi trên:

1. Lấy IP thật của client từ header `x-forwarded-for` (Vercel luôn set header này ở edge).
2. Đọc `User-Agent`. Nếu chứa "Googlebot" hoặc "bingbot" (không phân biệt hoa thường):
   - Đối chiếu IP với danh sách IP chính thức Google/Bing (tải từ 2 URL công khai của họ, cache lại
     trong Redis 24h để không phải tải lại mỗi request).
   - Khớp thật → **bỏ qua toàn bộ giới hạn**, cho request đi tiếp ngay (giữ nguyên logic middleware
     cũ: refresh session, cấp cookie `khach_id`).
   - Không khớp (giả danh User-Agent) → rơi xuống bước 3 như request thường.
3. Còn lại (người đọc thật + bot giả danh không khớp IP): kiểm tra bộ đếm sliding window
   **15 request / 10 giây** theo IP đó, lưu trong Upstash Redis (dùng chung giữa mọi server function
   của Vercel — bắt buộc vì Vercel chạy nhiều instance song song, bộ nhớ trong 1 instance không đếm
   đúng tổng request thật của 1 IP).
   - Chưa vượt ngưỡng → cho qua như bình thường.
   - Vượt ngưỡng → trả thẳng 1 trang HTML nhỏ, status 429, nội dung "Bạn thao tác quá nhanh, vui
     lòng thử lại sau vài giây." — **không gọi Supabase, không chạy logic middleware cũ** (tiết kiệm
     tài nguyên đúng lúc đang bị dồn tải). IP đó tự được mở lại sau khi cửa sổ 10 giây trôi qua.

## Các file mới/sửa

### `lib/utils/xac-minh-bot.ts` (hàm thuần, có unit test)
```ts
export function layIpTuHeader(header: string | null): string | null {
  if (!header) return null;
  const ip = header.split(',')[0]?.trim();
  return ip || null;
}

export function ipTrongDaiCidr(ip: string, cidr: string): boolean {
  const [dai, bitStr] = cidr.split('/');
  const bit = parseInt(bitStr, 10);
  if (!dai || Number.isNaN(bit)) return false;

  const ipSo = ipv4ThanhSo(ip);
  const daiSo = ipv4ThanhSo(dai);
  if (ipSo === null || daiSo === null) return false;

  const mask = bit === 0 ? 0 : (~0 << (32 - bit)) >>> 0;
  return (ipSo & mask) === (daiSo & mask);
}

export function ipTrongDanhSach(ip: string, danhSachCidr: string[]): boolean {
  return danhSachCidr.some((cidr) => ipTrongDaiCidr(ip, cidr));
}

function ipv4ThanhSo(ip: string): number | null {
  const phan = ip.split('.').map(Number);
  if (phan.length !== 4 || phan.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((phan[0] << 24) | (phan[1] << 16) | (phan[2] << 8) | phan[3]) >>> 0;
}
```
Chỉ xử lý IPv4 (đủ dùng cho phần lớn traffic Googlebot/Bing thật lẫn traffic đọc truyện thông
thường) — bỏ qua IPv6, ghi rõ giới hạn này trong mục "Không làm trong lần này".

### `lib/rate-limit/gioi-han-bot.ts` (cần Redis/fetch mạng, không unit test — kiểm chứng qua browser)
```ts
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const KHOA_CACHE_IP_BOT = 'danh_sach_ip_bot_that';
const TTL_CACHE_GIAY = 60 * 60 * 24; // 24h

export async function layDanhSachIpBotThat(redis: Redis): Promise<string[]> {
  try {
    const cache = await redis.get<string[]>(KHOA_CACHE_IP_BOT);
    if (cache) return cache;

    const [resGoogle, resBing] = await Promise.all([
      fetch('https://developers.google.com/static/search/apis/ipranges/googlebot.json'),
      fetch('https://www.bing.com/toolbox/bingbot.json'),
    ]);
    const [textGoogle, textBing] = await Promise.all([resGoogle.text(), resBing.text()]);

    const regexCidr = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}/g;
    const danhSach = [
      ...(textGoogle.match(regexCidr) ?? []),
      ...(textBing.match(regexCidr) ?? []),
    ];

    await redis.set(KHOA_CACHE_IP_BOT, danhSach, { ex: TTL_CACHE_GIAY });
    return danhSach;
  } catch {
    return [];
  }
}

export function taoRateLimiter(redis: Redis): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '10 s'),
    prefix: 'gioi_han_truyen',
  });
}
```
Trích CIDR bằng regex thẳng từ nội dung phản hồi (không parse đúng cấu trúc JSON của Google/Bing) —
đơn giản, không phụ thuộc schema của họ có thể đổi theo thời gian.

### `middleware.ts` (sửa)
Thêm đầu hàm `middleware`, trước logic cũ:
```ts
if (request.nextUrl.pathname.startsWith('/truyen/')) {
  try {
    const redis = Redis.fromEnv();
    const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
    const userAgent = request.headers.get('user-agent') ?? '';
    const tuXungLaBotTot = /googlebot|bingbot/i.test(userAgent);

    let boQuaGioiHan = false;
    if (tuXungLaBotTot && ip) {
      const danhSachIp = await layDanhSachIpBotThat(redis);
      boQuaGioiHan = ipTrongDanhSach(ip, danhSachIp);
    }

    if (!boQuaGioiHan && ip) {
      const { success } = await taoRateLimiter(redis).limit(ip);
      if (!success) {
        return new NextResponse(
          '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>Bạn thao tác quá nhanh</h1><p>Vui lòng thử lại sau vài giây.</p></body>',
          { status: 429, headers: { 'content-type': 'text/html; charset=utf-8' } }
        );
      }
    }
  } catch {
    // Upstash lỗi/hết quota → fail-open, không để 1 dịch vụ phụ làm sập cả site.
  }
}
```
Phần còn lại của `middleware.ts` (refresh session, cookie `khach_id`) giữ nguyên, không đổi.

### `package.json`
Thêm dependency: `@upstash/redis`, `@upstash/ratelimit`.

### `.env.local.example`
Thêm 2 dòng: `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`.

## Việc thủ công user tự làm (đã xong trước khi viết plan)
- Đăng ký Upstash, tạo Redis database (region Singapore, gói Free).
- Đã điền `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` vào `.env.local` (local) và Vercel →
  Project Settings → Environments → Production → Environment Variables (production).

## Edge cases
- Không lấy được IP (header thiếu) → cho qua, không chặn.
- Tải danh sách IP Google/Bing thất bại → coi như chưa xác minh được, áp dụng rate limit bình
  thường cho request đó (chấp nhận rủi ro rất nhỏ Googlebot thật bị chặn tạm 1 request hiếm khi
  trùng lúc lỗi mạng, còn hơn mở toang cho giả danh).
- Upstash lỗi kết nối/hết quota → bọc try/catch quanh toàn bộ khối rate-limit, lỗi thì **cho qua**
  (fail-open).
- Nhiều IP dùng chung 1 NAT (ví dụ cùng công ty/trường học) có thể vô tình bị đếm chung — chấp nhận
  ở v1, ngưỡng 15 request/10 giây đủ rộng để hiếm khi ảnh hưởng nhóm nhỏ đọc thật cùng lúc.

## Không làm trong lần này
- Không xử lý IPv6 (chỉ so khớp CIDR IPv4).
- Không phân biệt/chặn theo mục đích xấu (ăn cắp nội dung) — đó là việc riêng "chặn copy nâng cao"
  bàn sau.
- Không có trang admin xem thống kê IP bị chặn.
- Không áp dụng cho route khác ngoài `/truyen/*`.

## Testing
- Unit test cho `lib/utils/xac-minh-bot.ts`: `ipTrongDaiCidr` (khớp đúng/sai dải CIDR, biên
  `/32`, `/0`), `layIpTuHeader` (header có nhiều IP phân cách bởi dấu phẩy, header rỗng/null).
- Kiểm chứng thật qua browser/curl (Claude tự làm, không cần đăng nhập): gửi liên tục >15 request
  trong 10 giây tới 1 trang `/truyen/[slug]/chuong/[so]` → xác nhận nhận 429 từ request thứ 16 trở
  đi, và tự hết chặn sau ~10 giây. Xác nhận trang chủ/trang thể loại không bị ảnh hưởng.
