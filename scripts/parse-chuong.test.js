import { describe, it, expect } from 'vitest';
import { parseChuong } from './parse-chuong.js';

const MAU_HOP_LE = `# Chương 1: Thế đạo thối nát tận xương

Tào Bút ngồi thu lu ở góc tường, ngước nhìn vầng trăng trên trời.

Xuyên không đã ba năm rồi.
`;

describe('parseChuong', () => {
  it('tach dung so chuong tu ten file', () => {
    const kq = parseChuong('chuong-001.md', MAU_HOP_LE);
    expect(kq.soChuong).toBe(1);
  });

  it('tach dung tieu de tu dong dau (bo phan "Chuong N:")', () => {
    const kq = parseChuong('chuong-001.md', MAU_HOP_LE);
    expect(kq.tieuDe).toBe('Thế đạo thối nát tận xương');
  });

  it('lay dung noi dung con lai, da trim', () => {
    const kq = parseChuong('chuong-001.md', MAU_HOP_LE);
    expect(kq.noiDung).toBe(
      'Tào Bút ngồi thu lu ở góc tường, ngước nhìn vầng trăng trên trời.\n\nXuyên không đã ba năm rồi.'
    );
  });

  it('nem loi neu ten file sai dinh dang', () => {
    expect(() => parseChuong('chuong-1.md', MAU_HOP_LE)).toThrow();
  });

  it('chap nhan dong tieu de khong co dau "#" (dinh dang khac tu D:\\translate truyen)', () => {
    const noiDung = `Chương 5: Mở đầu mới\n\nNoi dung chuong 5.\n`;
    const kq = parseChuong('chuong-005.md', noiDung);
    expect(kq.soChuong).toBe(5);
    expect(kq.tieuDe).toBe('Mở đầu mới');
    expect(kq.noiDung).toBe('Noi dung chuong 5.');
  });

  it('nem loi neu file thieu dong tieu de bat dau bang #', () => {
    expect(() => parseChuong('chuong-002.md', 'Khong co tieu de\n\nNoi dung')).toThrow();
  });

  it('nem loi neu file khong co noi dung sau dong tieu de', () => {
    expect(() => parseChuong('chuong-003.md', '# Chương 3: Trống\n\n')).toThrow();
  });
});
