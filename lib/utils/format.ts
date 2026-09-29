/**
 * Rút gọn số hiển thị cho lượt xem, theo dõi, đánh giá
 * Ví dụ: 842 -> "842", 12500 -> "12.5K", 12000 -> "12K", 3400000 -> "3.4M"
 */
export function dinhDangSoRutGon(so: number | null | undefined): string {
  if (so === null || so === undefined || so < 0 || isNaN(so)) {
    return '0';
  }

  if (so < 1000) {
    return Math.floor(so).toString();
  }

  if (so < 1000000) {
    const giaTriK = so / 1000;
    const dinhDang = giaTriK.toFixed(1);
    return dinhDang.endsWith('.0') ? `${Math.floor(giaTriK)}K` : `${dinhDang}K`;
  }

  const giaTriM = so / 1000000;
  const dinhDang = giaTriM.toFixed(1);
  return dinhDang.endsWith('.0') ? `${Math.floor(giaTriM)}M` : `${dinhDang}M`;
}

/**
 * Khoảng thời gian tương đối kiểu "5 phút trước", "3 ngày trước".
 * Mốc trong tương lai (lệch đồng hồ) hoặc không hợp lệ -> "vừa xong" / "".
 */
export function thoiGianTruoc(iso: string | null | undefined, bayGio: number = Date.now()): string {
  if (!iso) return '';
  const moc = new Date(iso).getTime();
  if (Number.isNaN(moc)) return '';
  const giay = Math.floor((bayGio - moc) / 1000);
  if (giay < 60) return 'vừa xong';
  const phut = Math.floor(giay / 60);
  if (phut < 60) return `${phut} phút trước`;
  const gio = Math.floor(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  const ngay = Math.floor(gio / 24);
  if (ngay < 30) return `${ngay} ngày trước`;
  const thang = Math.floor(ngay / 30);
  if (thang < 12) return `${thang} tháng trước`;
  return `${Math.floor(thang / 12)} năm trước`;
}
