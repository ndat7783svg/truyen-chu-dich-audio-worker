import { describe, it, expect } from 'vitest';
import {
  locChuongDuocNghe,
  taoDanhSachPhat,
  urlDoan,
  type ChuongNguon,
} from './danh-sach-phat';

const TRUYEN = '11111111-1111-4111-8111-111111111111';
const VE = { chuongToiDa: 52, hetHan: 1800000000, k: 'abcdef' };

function chuong(so: number, noiDung = 'Câu một. Câu hai. Câu ba.'): ChuongNguon {
  return { chuongId: `id-${so}`, soChuong: so, tieuDe: `Chương ${so}`, noiDung };
}

describe('locChuongDuocNghe', () => {
  const ds = [chuong(49), chuong(50), chuong(51), chuong(52)];

  it('khách chưa đăng nhập: dừng trước chương 51, lý do chưa đăng nhập', () => {
    const kq = locChuongDuocNghe(ds, { daDangNhap: false, coVip: false });
    expect(kq.duocNghe.map((c) => c.soChuong)).toEqual([49, 50]);
    expect(kq.dungLai).toEqual({ soChuong: 51, lyDo: 'chua_dang_nhap' });
  });

  it('đã đăng nhập nhưng chưa VIP: lý do cần VIP', () => {
    const kq = locChuongDuocNghe(ds, { daDangNhap: true, coVip: false });
    expect(kq.dungLai).toEqual({ soChuong: 51, lyDo: 'can_vip' });
  });

  it('có VIP: nghe hết, không dừng', () => {
    const kq = locChuongDuocNghe(ds, { daDangNhap: true, coVip: true });
    expect(kq.duocNghe.length).toBe(4);
    expect(kq.dungLai).toBeNull();
  });

  it('chương hiện tại đã bị chặn: duocNghe rỗng', () => {
    const kq = locChuongDuocNghe([chuong(80)], { daDangNhap: false, coVip: false });
    expect(kq.duocNghe).toEqual([]);
    expect(kq.dungLai?.soChuong).toBe(80);
  });
});

describe('urlDoan', () => {
  it('chương free không kèm vé (để CDN dùng chung)', () => {
    expect(urlDoan(TRUYEN, 50, 3, VE)).toBe(`/api/audio/doan?t=${TRUYEN}&c=50&i=3`);
  });
  it('chương VIP kèm vé', () => {
    expect(urlDoan(TRUYEN, 51, 0, VE)).toBe(
      `/api/audio/doan?t=${TRUYEN}&c=51&i=0&h=1800000000&m=52&k=abcdef`
    );
  });
  it('chương VIP mà thiếu vé thì không tự bịa vé', () => {
    expect(urlDoan(TRUYEN, 51, 0, null)).toBe(`/api/audio/doan?t=${TRUYEN}&c=51&i=0`);
  });
});

describe('taoDanhSachPhat', () => {
  it('mốc thời gian và chỉ số đoạn toàn cục liên tục giữa các chương', () => {
    const { chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1), chuong(2)], null, null);
    expect(chuongs[0].batDauGiay).toBe(0);
    expect(chuongs[0].doanBatDau).toBe(0);
    expect(chuongs[1].batDauGiay).toBeCloseTo(chuongs[0].thoiLuongGiay, 5);
    expect(chuongs[1].doanBatDau).toBe(chuongs[0].soDoan);
  });

  it('soChuongSau: chương kế trong danh sách, chương cuối lấy từ chuongSauCuoi', () => {
    const { chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1), chuong(2)], null, { chuongId: 'id-3', soChuong: 3 });
    expect(chuongs[0].soChuongSau).toBe(2);
    expect(chuongs[0].chuongIdSau).toBe('id-2');
    expect(chuongs[1].soChuongSau).toBe(3);
    expect(chuongs[1].chuongIdSau).toBe('id-3');
  });

  it('chuongSauCuoi null: chương cuối không có soChuongSau', () => {
    const { chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1)], null, null);
    expect(chuongs[0].soChuongSau).toBeUndefined();
  });

  it('m3u8 đúng định dạng VOD, kết thúc bằng ENDLIST, targetduration >= mọi EXTINF', () => {
    const noiDung = 'Một câu khá dài để tạo nhiều đoạn khác nhau trong chương. '.repeat(20);
    const { m3u8, chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1, noiDung)], null, null);
    const dong = m3u8.trim().split('\n');
    expect(dong[0]).toBe('#EXTM3U');
    expect(dong).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(dong[dong.length - 1]).toBe('#EXT-X-ENDLIST');

    const target = Number(dong.find((d) => d.startsWith('#EXT-X-TARGETDURATION:'))!.split(':')[1]);
    const cacExtinf = dong.filter((d) => d.startsWith('#EXTINF:')).map((d) => Number(d.slice(8, -1)));
    expect(cacExtinf.length).toBe(chuongs[0].soDoan);
    cacExtinf.forEach((t) => expect(t).toBeLessThanOrEqual(target));
  });

  it('URL đoạn theo đúng thứ tự (c, i) và chỉ chương >50 mang vé', () => {
    const { m3u8 } = taoDanhSachPhat(TRUYEN, [chuong(50), chuong(51)], VE, null);
    const urls = m3u8.split('\n').filter((d) => d.startsWith('/api/audio/doan'));
    const url50 = urls.filter((u) => u.includes('&c=50&'));
    const url51 = urls.filter((u) => u.includes('&c=51&'));
    expect(url50.length).toBeGreaterThan(0);
    expect(url51.length).toBeGreaterThan(0);
    url50.forEach((u) => expect(u).not.toContain('&k='));
    url51.forEach((u) => expect(u).toContain('&k=abcdef'));
    expect(urls[0]).toContain('&c=50&i=0');
  });
});
