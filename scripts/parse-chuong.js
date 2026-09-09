export function parseChuong(tenFile, noiDungFile) {
  const khopSo = tenFile.match(/^chuong-(\d{3})\.md$/);
  if (!khopSo) {
    throw new Error(`Ten file khong dung dinh dang chuong-XXX.md: ${tenFile}`);
  }
  const soChuong = parseInt(khopSo[1], 10);

  const dong = noiDungFile.split('\n');
  const dongDauTien = (dong[0] || '').trim();
  if (!dongDauTien.startsWith('#')) {
    throw new Error(`File ${tenFile} thieu dong tieu de bat dau bang "#"`);
  }

  const khopTieuDe = dongDauTien.match(/^#\s*Ch[uư][oơ]ng\s+\d+\s*:\s*(.+)$/i);
  const tieuDe = khopTieuDe ? khopTieuDe[1].trim() : dongDauTien.replace(/^#\s*/, '').trim();

  const noiDung = dong.slice(1).join('\n').trim();
  if (!noiDung) {
    throw new Error(`File ${tenFile} khong co noi dung sau dong tieu de`);
  }

  return { soChuong, tieuDe, noiDung };
}
