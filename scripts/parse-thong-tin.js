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

function timTheLoai(noiDung) {
  const khop = noiDung.match(/^\*\*Thể loại:\*\*\s*(.+)$/m);
  if (!khop) return [];
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
  const khop = noiDung.match(/^##\s*Giới thiệu\s*$/m);
  if (!khop) return null;
  const phanConLai = noiDung.slice(khop.index + khop[0].length);
  const viTriHeadingKe = phanConLai.search(/^##\s/m);
  const noiDungGioiThieu =
    viTriHeadingKe === -1 ? phanConLai : phanConLai.slice(0, viTriHeadingKe);
  const ketQua = noiDungGioiThieu.trim();
  return ketQua || null;
}
