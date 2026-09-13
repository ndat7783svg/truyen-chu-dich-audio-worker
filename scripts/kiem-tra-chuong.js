export function laySoChuongTuTieuDe(dongDauTien) {
  const khop = dongDauTien.match(/Ch[uư][oơ]ng\s+(\d+)/i);
  return khop ? parseInt(khop[1], 10) : null;
}

export function kiemTraTinhLienTuc(danhSach) {
  const soFile = danhSach.map((d) => d.soChuongFile).sort((a, b) => a - b);

  const thieu = [];
  if (soFile.length > 0) {
    const boSo = new Set(soFile);
    for (let i = soFile[0]; i <= soFile[soFile.length - 1]; i += 1) {
      if (!boSo.has(i)) thieu.push(i);
    }
  }

  const lechTieuDe = danhSach
    .filter((d) => d.soChuongTieuDe !== null && d.soChuongTieuDe !== d.soChuongFile)
    .map((d) => ({ soChuongFile: d.soChuongFile, soChuongTieuDe: d.soChuongTieuDe }));

  return {
    thieu,
    lechTieuDe,
    tongSo: soFile.length,
    min: soFile.length > 0 ? soFile[0] : null,
    max: soFile.length > 0 ? soFile[soFile.length - 1] : null,
  };
}
