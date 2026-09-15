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

  // 2. Fast-Path: Chỉ gọi Supabase Auth khi request mang cookie phiên đăng nhập
  const coCookieAuth = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

  if (coCookieAuth) {
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
  }

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
    // Next.js tự động gửi request "prefetch" cho mọi <Link> hiện trong màn hình (vd trang danh sách
    // 50 chương hiện 1 lúc hàng chục link) - không phải do người dùng chủ động bấm, nhưng vẫn tính
    // cùng URL /truyen/* nên trước đây bị đếm chung vào giới hạn, khiến khách đọc bình thường (chỉ
    // cần trang hiện nhiều link) cũng bị chặn nhầm dù thao tác chậm. Bỏ qua các request prefetch này
    // khỏi giới hạn tốc độ - chỉ đếm điều hướng thật (bấm link/gõ URL).
    const laPrefetch =
      request.headers.has('next-router-prefetch') ||
      request.headers.has('next-router-segment-prefetch');
    if (laPrefetch) return null;

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
