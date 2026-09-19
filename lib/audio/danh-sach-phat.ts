import { chiaDoan, uocThoiLuongGiay } from './chia-doan';
import type { VeAudio } from './ve-audio';
import { SO_CHUONG_FREE } from '../config/goi-vip';

export const SO_CHUONG_TOI_DA_TRONG_DANH_SACH = 11; // chương hiện tại + 10 chương kế tiếp

export type ChuongNguon = { chuongId: string; soChuong: number; tieuDe: string; noiDung: string };
export type QuyenNghe = { daDangNhap: boolean; coVip: boolean };
export type LyDoDungLai = 'chua_dang_nhap' | 'can_vip';
export type DungLai = { soChuong: number; lyDo: LyDoDungLai };

export type MucManifest = {
  chuongId: string;
  soChuong: number;
  tieuDe: string;
  batDauGiay: number; // mốc bắt đầu chương trong toàn playlist (giây, ước lượng)
  thoiLuongGiay: number; // thời lượng chương (giây, ước lượng)
  soDoan: number;
  doanBatDau: number; // chỉ số đoạn toàn cục đầu tiên của chương (khớp `sn` của hls.js)
  soChuongSau?: number;
  chuongIdSau?: string;
};

export function chuongDuocNghe(soChuong: number, quyen: QuyenNghe): boolean {
  return soChuong <= SO_CHUONG_FREE || quyen.coVip;
}

// Lấy các chương liên tiếp từ đầu danh sách cho tới khi gặp chương đầu tiên không được nghe.
export function locChuongDuocNghe(
  danhSach: ChuongNguon[],
  quyen: QuyenNghe
): { duocNghe: ChuongNguon[]; dungLai: DungLai | null } {
  const duocNghe: ChuongNguon[] = [];
  for (const c of danhSach) {
    if (!chuongDuocNghe(c.soChuong, quyen)) {
      return {
        duocNghe,
        dungLai: { soChuong: c.soChuong, lyDo: quyen.daDangNhap ? 'can_vip' : 'chua_dang_nhap' },
      };
    }
    duocNghe.push(c);
  }
  return { duocNghe, dungLai: null };
}

export function urlDoan(truyenId: string, soChuong: number, chiSo: number, ve: VeAudio | null): string {
  let url = `/api/audio/doan?t=${truyenId}&c=${soChuong}&i=${chiSo}`;
  // Chương free KHÔNG mang vé để URL giống nhau giữa mọi người -> CDN lưu tạm dùng chung.
  if (soChuong > SO_CHUONG_FREE && ve) url += `&h=${ve.hetHan}&m=${ve.chuongToiDa}&k=${ve.k}`;
  return url;
}

export function taoDanhSachPhat(
  truyenId: string,
  chuongs: ChuongNguon[],
  ve: VeAudio | null,
  chuongSauCuoi: { chuongId: string; soChuong: number } | null
): { m3u8: string; chuongs: MucManifest[] } {
  const manifest: MucManifest[] = [];
  const cacDoan: { thoiLuong: number; url: string }[] = [];
  let tichLuyGiay = 0;

  chuongs.forEach((c, k) => {
    const doan = chiaDoan(c.tieuDe, c.noiDung);
    const thoiLuongDoan = doan.map(uocThoiLuongGiay);
    const thoiLuongChuong = thoiLuongDoan.reduce((a, b) => a + b, 0);
    const sau = chuongs[k + 1] ?? chuongSauCuoi ?? null;

    manifest.push({
      chuongId: c.chuongId,
      soChuong: c.soChuong,
      tieuDe: c.tieuDe,
      batDauGiay: tichLuyGiay,
      thoiLuongGiay: thoiLuongChuong,
      soDoan: doan.length,
      doanBatDau: cacDoan.length,
      soChuongSau: sau?.soChuong,
      chuongIdSau: sau?.chuongId,
    });

    doan.forEach((_, i) => {
      cacDoan.push({ thoiLuong: thoiLuongDoan[i], url: urlDoan(truyenId, c.soChuong, i, ve) });
    });
    tichLuyGiay += thoiLuongChuong;
  });

  const target = Math.max(1, Math.ceil(Math.max(...cacDoan.map((d) => d.thoiLuong))));
  const dong = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${target}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];
  for (const d of cacDoan) {
    dong.push(`#EXTINF:${d.thoiLuong.toFixed(3)},`, d.url);
  }
  dong.push('#EXT-X-ENDLIST');

  return { m3u8: dong.join('\n') + '\n', chuongs: manifest };
}
