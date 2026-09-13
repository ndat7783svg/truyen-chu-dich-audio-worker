import { describe, it, expect } from 'vitest';
import { parseThongTin } from './parse-thong-tin.js';

const MAU_DAY_DU = `# Tên Truyện Mẫu (示例名称)

**Tác giả gốc:** Tác Giả Mẫu
**Thể loại:** Huyền Huyễn / Tiên Hiệp / Xuyên Không (Bối cảnh giả lập dùng để kiểm thử, không liên quan nội dung thật.)
**Văn phong / xưng hô:**
- Ngôi kể truyện: Ngôi thứ ba.

## Giới thiệu

Đây là đoạn giới thiệu mẫu dùng riêng cho test, không phải nội dung truyện thật.

Dòng thứ hai của đoạn giới thiệu mẫu.
`;

describe('parseThongTin', () => {
  it('tach dung tac gia', () => {
    const kq = parseThongTin(MAU_DAY_DU);
    expect(kq.tacGia).toBe('Tác Giả Mẫu');
  });

  it('tach dung danh sach the loai, bo phan mo ta trong ngoac', () => {
    const kq = parseThongTin(MAU_DAY_DU);
    expect(kq.theLoai).toEqual(['Huyền Huyễn', 'Tiên Hiệp', 'Xuyên Không']);
  });

  it('lay dung noi dung gioi thieu, da trim', () => {
    const kq = parseThongTin(MAU_DAY_DU);
    expect(kq.moTa).toBe(
      'Đây là đoạn giới thiệu mẫu dùng riêng cho test, không phải nội dung truyện thật.\n\nDòng thứ hai của đoạn giới thiệu mẫu.'
    );
  });

  it('the_loai la mang rong neu thieu dong Thể loại', () => {
    const noiDung = '**Tác giả gốc:** X\n\n## Giới thiệu\n\nMô tả.';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual([]);
  });

  it('mo_ta la null neu thieu muc Gioi thieu', () => {
    const noiDung = '**Tác giả gốc:** X\n**Thể loại:** A / B';
    const kq = parseThongTin(noiDung);
    expect(kq.moTa).toBeNull();
  });

  it('tach dung the loai khi khong co ngoac mo ta', () => {
    const noiDung = '**Thể loại:** A / B / C';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual(['A', 'B', 'C']);
  });

  it('tach dung the loai khi dung dau phay thay vi dau /', () => {
    const noiDung = '**Thể loại:** Huyền huyễn, Dị giới, Xuyên không, Hệ thống';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual(['Huyền huyễn', 'Dị giới', 'Xuyên không', 'Hệ thống']);
  });

  it('tach dung the loai khi tron lan dau phay va dau /', () => {
    const noiDung =
      '**Thể loại:** Huyền huyễn, Dị giới, Xuyên không, Hệ thống / Tăng phúc mỗi ngày, Nhục thân thành thánh, Vô địch lưu';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual([
      'Huyền huyễn',
      'Dị giới',
      'Xuyên không',
      'Hệ thống',
      'Tăng phúc mỗi ngày',
      'Nhục thân thành thánh',
      'Vô địch lưu',
    ]);
  });

  it('tac_gia la null neu thieu dong Tac gia goc', () => {
    const noiDung = '**Thể loại:** A';
    const kq = parseThongTin(noiDung);
    expect(kq.tacGia).toBeNull();
  });
});
