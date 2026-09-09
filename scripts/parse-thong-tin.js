export function parseThongTin(noiDung) {
  return {
    tacGia: timTacGia(noiDung),
    theLoai: timTheLoai(noiDung),
    moTa: timMoTa(noiDung),
  };
}

function timTacGia(noiDung) {
  const khop = noiDung.match(/^\*\*Tác giả gốc:\*\*\s*(.+)$/m);
  return khop ? khop[1].trim() : null;
}

function timTheLoai(noiDung) {
  const khop = noiDung.match(/^\*\*Thể loại:\*\*\s*(.+)$/m);
  if (!khop) return [];
  const phanThoLoai = khop[1].split('(')[0];
  return phanThoLoai
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
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
