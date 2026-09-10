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
