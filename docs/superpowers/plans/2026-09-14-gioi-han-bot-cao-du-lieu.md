# Giới hạn tốc độ request chống bot cào quá tải — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Lưu ý riêng cho dự án này**: theo `CLAUDE.md`, mọi task code đủ lớn phải giao cho Antigravity
> qua MCP theo skill `delegate-antigravity-sk` (Claude quản lý: duyệt, kiểm tra, lặp sửa lỗi) thay
> vì `subagent-driven-development`/`executing-plans` — 2 skill đó không áp dụng cho dự án này.

**Goal:** Chặn 1 client (bot cào) gửi quá nhiều request/giây tới trang truyện + trang đọc chương,
tránh làm nghẽn Supabase/Vercel như sự cố tối 2026-09-13, mà không ảnh hưởng Googlebot/Bing thật
(cần cho SEO) hay người đọc thật.

**Architecture:** Thêm logic vào `middleware.ts` hiện có — với path `/truyen/*`, xác minh IP có
phải Googlebot/Bing thật không (đối chiếu danh sách IP chính thức, cache 24h trong Redis) để bỏ qua
giới hạn; còn lại áp dụng rate limit sliding-window 15 request/10 giây theo IP qua Upstash Redis,
vượt ngưỡng thì trả 429 ngay, không gọi Supabase.

**Tech Stack:** Next.js Edge Middleware, Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`),
Vitest cho unit test.

## Global Constraints
- Chỉ áp dụng cho path bắt đầu bằng `/truyen/` — không đụng trang chủ/tìm kiếm/thể loại/tài khoản.
- Ngưỡng cố định: **15 request / 10 giây** theo IP.
- Không bao giờ được chặn Googlebot/Bing thật (bắt buộc xác minh IP, không chỉ tin User-Agent).
- Lỗi ở Upstash (hết quota, mất kết nối) phải **fail-open** — cho request đi tiếp bình thường, không
  làm sập cả site.
- Chỉ xử lý IPv4 (bỏ qua IPv6) — giới hạn đã biết, chấp nhận ở v1.
- Tên biến/hàm bằng tiếng Việt không dấu kiểu camelCase, đúng phong cách code hiện có trong dự án
  (xem `lib/utils/theme.ts`, `lib/utils/gia-han-vip.ts` làm ví dụ).

---

## Task 1: Hàm thuần xác minh IP (CIDR + parse header)

**Files:**
- Create: `lib/utils/xac-minh-bot.ts`
- Test: `lib/utils/xac-minh-bot.test.ts`

**Interfaces:**
- Produces: `layIpTuHeader(header: string | null): string | null`, `ipTrongDaiCidr(ip: string, cidr: string): boolean`, `ipTrongDanhSach(ip: string, danhSachCidr: string[]): boolean` — dùng ở Task 3 (`middleware.ts`).

- [ ] **Step 1: Viết test trước**

Tạo `lib/utils/xac-minh-bot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { layIpTuHeader, ipTrongDaiCidr, ipTrongDanhSach } from './xac-minh-bot';

describe('layIpTuHeader', () => {
  it('lay IP dau tien khi header co nhieu IP phan cach boi dau phay', () => {
    expect(layIpTuHeader('1.2.3.4, 5.6.7.8')).toBe('1.2.3.4');
  });

  it('trim khoang trang quanh IP', () => {
    expect(layIpTuHeader('  1.2.3.4  ,5.6.7.8')).toBe('1.2.3.4');
  });

  it('header null tra null', () => {
    expect(layIpTuHeader(null)).toBeNull();
  });

  it('header rong tra null', () => {
    expect(layIpTuHeader('')).toBeNull();
  });
});

describe('ipTrongDaiCidr', () => {
  it('khop khi IP nam trong dai /24', () => {
    expect(ipTrongDaiCidr('192.168.1.5', '192.168.1.0/24')).toBe(true);
  });

  it('khong khop khi IP ngoai dai /24', () => {
    expect(ipTrongDaiCidr('192.168.2.5', '192.168.1.0/24')).toBe(false);
  });

  it('khop /32 (1 IP duy nhat)', () => {
    expect(ipTrongDaiCidr('10.0.0.1', '10.0.0.1/32')).toBe(true);
    expect(ipTrongDaiCidr('10.0.0.2', '10.0.0.1/32')).toBe(false);
  });

  it('/0 khop moi IP', () => {
    expect(ipTrongDaiCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
  });

  it('CIDR khong hop le tra false', () => {
    expect(ipTrongDaiCidr('1.2.3.4', 'khong-phai-cidr')).toBe(false);
  });

  it('IP khong hop le tra false', () => {
    expect(ipTrongDaiCidr('999.1.1.1', '1.2.3.0/24')).toBe(false);
  });
});

describe('ipTrongDanhSach', () => {
  it('true neu khop it nhat 1 CIDR trong danh sach', () => {
    expect(ipTrongDanhSach('192.168.1.5', ['10.0.0.0/8', '192.168.1.0/24'])).toBe(true);
  });

  it('false neu khong khop CIDR nao', () => {
    expect(ipTrongDanhSach('192.168.1.5', ['10.0.0.0/8'])).toBe(false);
  });

  it('false neu danh sach rong', () => {
    expect(ipTrongDanhSach('192.168.1.5', [])).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run lib/utils/xac-minh-bot.test.ts`
Expected: FAIL — không tìm thấy module `./xac-minh-bot`.

- [ ] **Step 3: Viết implementation**

Tạo `lib/utils/xac-minh-bot.ts`:

```ts
export function layIpTuHeader(header: string | null): string | null {
  if (!header) return null;
  const ip = header.split(',')[0]?.trim();
  return ip || null;
}

function ipv4ThanhSo(ip: string): number | null {
  const phan = ip.split('.').map(Number);
  if (phan.length !== 4 || phan.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((phan[0] << 24) | (phan[1] << 16) | (phan[2] << 8) | phan[3]) >>> 0;
}

export function ipTrongDaiCidr(ip: string, cidr: string): boolean {
  const [dai, bitStr] = cidr.split('/');
  const bit = parseInt(bitStr, 10);
  if (!dai || Number.isNaN(bit) || bit < 0 || bit > 32) return false;

  const ipSo = ipv4ThanhSo(ip);
  const daiSo = ipv4ThanhSo(dai);
  if (ipSo === null || daiSo === null) return false;

  const mask = bit === 0 ? 0 : (~0 << (32 - bit)) >>> 0;
  return (ipSo & mask) === (daiSo & mask);
}

export function ipTrongDanhSach(ip: string, danhSachCidr: string[]): boolean {
  return danhSachCidr.some((cidr) => ipTrongDaiCidr(ip, cidr));
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run lib/utils/xac-minh-bot.test.ts`
Expected: PASS toàn bộ 11 test.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/xac-minh-bot.ts lib/utils/xac-minh-bot.test.ts
git commit -m "feat: thêm hàm thuần xác minh IP CIDR + parse header cho rate limit"
```

---

## Task 2: Module rate-limit (Redis) + tích hợp vào middleware

**Files:**
- Modify: `package.json`, `package-lock.json` (qua `npm install`, không sửa tay)
- Create: `lib/rate-limit/gioi-han-bot.ts`
- Modify: `middleware.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `layIpTuHeader`, `ipTrongDanhSach` từ `lib/utils/xac-minh-bot.ts` (Task 1).
- Produces: `layDanhSachIpBotThat(redis: Redis): Promise<string[]>`, `taoRateLimiter(redis: Redis): Ratelimit` — dùng trong `middleware.ts`.

- [ ] **Step 1: Cài dependency**

Run: `npm install @upstash/redis @upstash/ratelimit`
Expected: `package.json`/`package-lock.json` được cập nhật thêm 2 package, không lỗi.

- [ ] **Step 2: Tạo module rate-limit**

Tạo `lib/rate-limit/gioi-han-bot.ts`:

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

- [ ] **Step 3: Sửa `middleware.ts`**

Đọc file `middleware.ts` hiện tại trước khi sửa — nội dung đầy đủ hiện tại:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // 1. Kiểm tra và cấp cookie khach_id nếu chưa tồn tại
  let khachId = request.cookies.get('khach_id')?.value;
  let canSetKhachId = false;

  if (!khachId) {
    khachId = crypto.randomUUID();
    canSetKhachId = true;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  // Đính kèm cookie khach_id vào response nếu vừa được tạo mới (hạn 2 năm)
  if (canSetKhachId && khachId) {
    response.cookies.set('khach_id', khachId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 năm
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Thay bằng nội dung mới (thêm nhánh rate-limit ở đầu hàm `middleware`, giữ nguyên toàn bộ phần sau):

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { layIpTuHeader, ipTrongDanhSach } from '@/lib/utils/xac-minh-bot';
import { layDanhSachIpBotThat, taoRateLimiter } from '@/lib/rate-limit/gioi-han-bot';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/truyen/')) {
    const trangQuaNhanh = await bViQuaNhanh(request);
    if (trangQuaNhanh) return trangQuaNhanh;
  }

  let response = NextResponse.next({ request });

  // 1. Kiểm tra và cấp cookie khach_id nếu chưa tồn tại
  let khachId = request.cookies.get('khach_id')?.value;
  let canSetKhachId = false;

  if (!khachId) {
    khachId = crypto.randomUUID();
    canSetKhachId = true;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  // Đính kèm cookie khach_id vào response nếu vừa được tạo mới (hạn 2 năm)
  if (canSetKhachId && khachId) {
    response.cookies.set('khach_id', khachId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 năm
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

async function bViQuaNhanh(request: NextRequest): Promise<NextResponse | null> {
  try {
    const redis = Redis.fromEnv();
    const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
    if (!ip) return null;

    const userAgent = request.headers.get('user-agent') ?? '';
    const tuXungLaBotTot = /googlebot|bingbot/i.test(userAgent);

    if (tuXungLaBotTot) {
      const danhSachIp = await layDanhSachIpBotThat(redis);
      if (ipTrongDanhSach(ip, danhSachIp)) return null;
    }

    const { success } = await taoRateLimiter(redis).limit(ip);
    if (success) return null;

    return new NextResponse(
      '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>Bạn thao tác quá nhanh</h1><p>Vui lòng thử lại sau vài giây.</p></body>',
      { status: 429, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  } catch {
    // Upstash lỗi/hết quota → fail-open, không để 1 dịch vụ phụ làm sập cả site.
    return null;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Thêm biến môi trường mẫu**

Sửa `.env.local.example`, thêm 2 dòng vào cuối file:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

(Giá trị thật đã được user điền vào `.env.local` và Vercel Environment Variables trước khi giao
task này — không cần làm lại bước đó.)

- [ ] **Step 5: Build để xác nhận không lỗi type**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 6: Chạy toàn bộ test**

Run: `npx vitest run`
Expected: toàn bộ test PASS (bao gồm 11 test mới của Task 1).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/rate-limit/gioi-han-bot.ts middleware.ts .env.local.example
git commit -m "feat: thêm rate limit theo IP cho /truyen/* chống bot cào quá tải, giữ SEO Googlebot/Bing thật"
```

---

## Task 3: Kiểm chứng thật qua request dồn dập (không cần đăng nhập, Claude tự làm)

**Files:** không tạo/sửa file — chỉ chạy lệnh kiểm chứng.

- [ ] **Step 1: Chạy dev server local**

Đảm bảo `.env.local` đã có `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` thật (user đã điền
trước khi bắt đầu Task 1). Chạy `npm run dev` (qua `preview_start` nếu dùng Browser pane, hoặc
`npm run dev` trực tiếp).

- [ ] **Step 2: Gửi 20 request liên tục trong <10 giây tới 1 trang chương**

Run (thay `<slug>` bằng 1 slug truyện thật đang có, ví dụ `pham-tran-phi-tien`, chương bất kỳ):

```bash
for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/truyen/pham-tran-phi-tien/chuong/1"; done
```

Expected: 15 dòng đầu in `200`, từ dòng thứ 16 trở đi in `429`.

- [ ] **Step 3: Đợi 10 giây, gửi lại 1 request, xác nhận IP đã được mở lại**

Run:
```bash
sleep 10 && curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/truyen/pham-tran-phi-tien/chuong/1"
```
Expected: `200` (không còn bị chặn).

- [ ] **Step 4: Xác nhận trang chủ/trang thể loại không bị ảnh hưởng**

Run:
```bash
for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/"; done
```
Expected: toàn bộ 20 dòng in `200` (trang chủ không nằm trong phạm vi `/truyen/*` nên không bị giới hạn).

- [ ] **Step 5: Deploy lên production sau khi 3 bước trên đều đúng**

Run: `npx vercel --prod --yes`
Expected: deploy thành công, alias vào `truyenchudich.site`.

- [ ] **Step 6: Lặp lại Step 2 trên domain thật để xác nhận production cũng hoạt động đúng**

Run (thay domain, giữ nguyên logic):
```bash
for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}\n" "https://truyenchudich.site/truyen/pham-tran-phi-tien/chuong/1"; done
```
Expected: giống Step 2 — 15 dòng `200`, từ dòng 16 trở đi `429`.
