export function parseThongTin(noiDung) {
  return {
    tacGia: timTacGia(noiDung),
    theLoai: timTheLoai(noiDung),
    moTa: timMoTa(noiDung),
    trangThai: timTrangThai(noiDung),
  };
}

function timTacGia(noiDung) {
  const khop = noiDung.match(/^\*\*Tác giả:\*\*\s*(.+)$/m);
  if (!khop) return null;
  const ten = khop[1].split('(')[0].trim();
  return ten || null;
}

// Một số truyện ghi thể loại dưới dạng mục `## Thể loại` + đoạn văn cách nhau bằng dấu phẩy (không có dòng
// `**Thể loại:**`), ví dụ "Đô thị hiện đại, cao võ (võ đạo siêu phàm), thiên tài lưu." — bỏ phần giải thích trong
// ngoặc (không cắt từ dấu "(" đầu tiên như dòng inline, kẻo mất các thể loại phía sau).
function timTheLoaiTheoMuc(noiDung) {
  const khop = noiDung.match(/^##\s*Thể loại\s*$/m);
  if (!khop) return [];
  const phanConLai = noiDung.slice(khop.index + khop[0].length);
  const viTriKe = phanConLai.search(/^(?:##\s|\*\*)/m);
  const doan = (viTriKe === -1 ? phanConLai : phanConLai.slice(0, viTriKe)).trim();
  return doan
    .replace(/\([^)]*\)/g, '')
    .split(/[/,]/)
    .map((s) => s.trim().replace(/[.。]+$/, '').trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

function timTheLoai(noiDung) {
  const khop = noiDung.match(/^\*\*Thể loại:\*\*\s*(.+)$/m);
  if (!khop) return timTheLoaiTheoMuc(noiDung);
  const phanThoLoai = khop[1].split('(')[0];
  return phanThoLoai
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function timTrangThai(noiDung) {
  const khop = noiDung.match(/^\*\*Trạng thái:\*\*\s*(.+)$/m);
  if (!khop) return null;
  const gtri = khop[1].trim().toLowerCase();
  return gtri === 'hoàn thành' ? 'hoan-thanh' : 'dang-ra';
}

function timMoTa(noiDung) {
  const khop = noiDung.match(/^##\s*(?:Giới thiệu|Tóm tắt)\s*$/m);
  if (!khop) return null;
  const phanConLai = noiDung.slice(khop.index + khop[0].length);
  const viTriHeadingKe = phanConLai.search(/^##\s/m);
  const noiDungGioiThieu =
    viTriHeadingKe === -1 ? phanConLai : phanConLai.slice(0, viTriHeadingKe);
  const ketQua = noiDungGioiThieu.trim();
  return ketQua || null;
}
