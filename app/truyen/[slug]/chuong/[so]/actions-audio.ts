'use server';

import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function yeuCauTaoAudioNgay(chuongId: string): Promise<{ thanhCong: boolean; loi?: string }> {
  try {
    const supabase = await taoSupabaseServerClient();

    // Đảm bảo chương có trong hàng đợi VÀ đặt lại so_lan_loi = 0 nếu đã từng lỗi 3 lần trước đó
    // (xem RPC xep_hang_tao_audio - đã sửa dùng ON CONFLICT DO UPDATE thay vì DO NOTHING). Quan
    // trọng: nếu không reset, chương từng bị worker định kỳ loại bỏ vĩnh viễn (so_lan_loi >= 3)
    // sẽ không bao giờ được cron nhặt lại nếu lỡ bước dispatch GitHub Actions bên dưới thất bại.
    const { error: loiRpc } = await supabase.rpc('xep_hang_tao_audio', {
      p_chuong_id: chuongId,
    });

    if (loiRpc) {
      console.error('Lỗi khi gọi RPC xep_hang_tao_audio:', loiRpc.message);
      return { thanhCong: false, loi: loiRpc.message };
    }

    // 2. Kích hoạt GitHub Actions workflow chạy ngay lập tức nếu có token
    const dispatchToken = process.env.GITHUB_DISPATCH_TOKEN;
    if (dispatchToken) {
      try {
        const phanHoi = await fetch(
          'https://api.github.com/repos/ndat7783svg/truyen-chu-dich-audio-worker/actions/workflows/worker-audio-chuong.yml/dispatches',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dispatchToken}`,
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'truyen-chu-dich-web',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: {
                chuong_id: chuongId,
              },
            }),
          }
        );

        if (!phanHoi.ok) {
          const chiTietLoi = await phanHoi.text();
          console.warn(`Không thể kích hoạt GitHub Actions (${phanHoi.status}):`, chiTietLoi);
        }
      } catch (loiKetNoi) {
        console.warn('Lỗi kết nối tới GitHub API khi trigger workflow:', loiKetNoi);
      }
    } else {
      console.warn('Thiếu GITHUB_DISPATCH_TOKEN - chương vẫn được lưu vào hàng đợi và sẽ chạy theo cron 5 phút.');
    }

    return { thanhCong: true };
  } catch (err) {
    const thongBaoLoi = err instanceof Error ? err.message : String(err);
    console.error('Lỗi trong yeuCauTaoAudioNgay:', thongBaoLoi);
    return { thanhCong: false, loi: thongBaoLoi };
  }
}
