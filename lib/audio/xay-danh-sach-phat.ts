import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import {
  SO_CHUONG_TOI_DA_TRONG_DANH_SACH,
  locChuongDuocNghe,
  taoDanhSachPhat,
  type DungLai,
  type MucManifest,
} from './danh-sach-phat';
import { layChuongTuSo, layQuyenNghe, taoSupabaseDichVu } from './du-lieu-chuong';
import { taoVe } from './ve-audio';

const HAN_VE_GIAY = 6 * 60 * 60;

export type KetQuaXay =
  | { loai: 'khong_co_chuong' }
  | { loai: 'bi_chan'; dungLai: DungLai }
  | {
      loai: 'ok';
      m3u8: string;
      manifest: {
        playlistUrl: string;
        chuongs: MucManifest[];
        dungLai: DungLai | null;
        chuongSauCuoi: { chuongId: string; soChuong: number } | null;
      };
    };

export async function xayDanhSachPhat(truyenId: string, soChuong: number): Promise<KetQuaXay> {
  const [quyen, danhSach] = await Promise.all([
    layQuyenNghe(),
    layChuongTuSo(taoSupabaseDichVu(), truyenId, soChuong, SO_CHUONG_TOI_DA_TRONG_DANH_SACH + 1),
  ]);
  if (danhSach.length === 0 || danhSach[0].soChuong !== soChuong) return { loai: 'khong_co_chuong' };

  const { duocNghe, dungLai } = locChuongDuocNghe(
    danhSach.slice(0, SO_CHUONG_TOI_DA_TRONG_DANH_SACH),
    quyen
  );
  if (duocNghe.length === 0 && dungLai) return { loai: 'bi_chan', dungLai };

  // Chương ngay sau chương cuối được nghe (có thể chính là chương bị chặn) - để hiện nút/tự chuyển chương.
  const tiepTheo = danhSach[duocNghe.length] ?? null;
  const chuongSauCuoi = tiepTheo ? { chuongId: tiepTheo.chuongId, soChuong: tiepTheo.soChuong } : null;

  let ve = null;
  const chuongCaoNhat = Math.max(...duocNghe.map((c) => c.soChuong));
  if (chuongCaoNhat > SO_CHUONG_FREE) {
    const boMat = process.env.AUDIO_TICKET_SECRET;
    if (!boMat) throw new Error('Thiếu AUDIO_TICKET_SECRET - từ chối tạo playlist chương VIP');
    // Vé không sống lâu hơn gói VIP: gói ngày sắp hết hạn thì vé cũng hết hạn cùng lúc.
    const hetHan = Math.min(
      Math.floor(Date.now() / 1000) + HAN_VE_GIAY,
      quyen.hetHanVipGiay ?? Number.MAX_SAFE_INTEGER
    );
    ve = taoVe(boMat, truyenId, chuongCaoNhat, hetHan);
  }

  const { m3u8, chuongs } = taoDanhSachPhat(truyenId, duocNghe, ve, chuongSauCuoi);
  return {
    loai: 'ok',
    m3u8,
    manifest: {
      playlistUrl: `/api/audio/playlist.m3u8?t=${truyenId}&c=${soChuong}`,
      chuongs,
      dungLai,
      chuongSauCuoi,
    },
  };
}
