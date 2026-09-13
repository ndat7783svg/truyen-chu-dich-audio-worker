'use server';

import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { layThongTinGoi } from '@/lib/config/goi-vip';
import { sinhMaGiaoDich } from '@/lib/utils/gia-han-vip';

export type KetQuaTaoGiaoDich =
  | { thanhCong: true; maGiaoDich: string; soTien: number; tenGoi: string }
  | { thanhCong: false; loi: string };

export async function taoGiaoDich(goiMa: string): Promise<KetQuaTaoGiaoDich> {
  const thongTinGoi = layThongTinGoi(goiMa);
  if (!thongTinGoi) return { thanhCong: false, loi: 'Gói không hợp lệ.' };

  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { thanhCong: false, loi: 'Bạn cần đăng nhập để mua gói.' };

  const SO_LAN_THU_TOI_DA = 3;
  for (let lanThu = 0; lanThu < SO_LAN_THU_TOI_DA; lanThu += 1) {
    const maGiaoDich = sinhMaGiaoDich();
    const { error } = await supabase.from('giao_dich').insert({
      nguoi_dung_id: user.id,
      ma_giao_dich: maGiaoDich,
      goi_loai: thongTinGoi.ma,
      so_tien: thongTinGoi.gia,
    });
    if (!error) {
      return {
        thanhCong: true,
        maGiaoDich,
        soTien: thongTinGoi.gia,
        tenGoi: thongTinGoi.ten,
      };
    }
    if (error.code !== '23505') {
      return { thanhCong: false, loi: 'Không tạo được giao dịch, thử lại sau.' };
    }
    // 23505 = trùng ma_giao_dich (hiếm gặp) — vòng lặp sẽ sinh mã khác và thử lại.
  }
  return { thanhCong: false, loi: 'Không tạo được giao dịch, thử lại sau.' };
}
