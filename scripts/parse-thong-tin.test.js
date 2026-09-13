import { describe, it, expect } from 'vitest';
import { parseThongTin } from './parse-thong-tin.js';

const MAU_DAY_DU = `# Tên Truyện Mẫu (示例名称)

**Tác giả:** Tác Giả Mẫu
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
    const noiDung = '**Tác giả:** X\n\n## Giới thiệu\n\nMô tả.';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual([]);
  });

  it('mo_ta la null neu thieu muc Gioi thieu', () => {
    const noiDung = '**Tác giả:** X\n**Thể loại:** A / B';
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

  it('tac_gia la null neu thieu dong Tac gia', () => {
    const noiDung = '**Thể loại:** A';
    const kq = parseThongTin(noiDung);
    expect(kq.tacGia).toBeNull();
  });

  it('tac_gia bo phan ten Han trong ngoac', () => {
    const noiDung = '**Tác giả:** Sinh Thái Tê Liệt Thú L-27 (生態撕裂獸l-27型)';
    const kq = parseThongTin(noiDung);
    expect(kq.tacGia).toBe('Sinh Thái Tê Liệt Thú L-27');
  });

  it('trang_thai la hoan-thanh khi ghi Hoan thanh', () => {
    const noiDung = '**Tác giả:** X\n**Trạng thái:** Hoàn thành';
    const kq = parseThongTin(noiDung);
    expect(kq.trangThai).toBe('hoan-thanh');
  });

  it('trang_thai la dang-ra khi ghi Dang ra', () => {
    const noiDung = '**Tác giả:** X\n**Trạng thái:** Đang ra';
    const kq = parseThongTin(noiDung);
    expect(kq.trangThai).toBe('dang-ra');
  });

  it('trang_thai la null neu thieu dong Trang thai', () => {
    const noiDung = '**Tác giả:** X';
    const kq = parseThongTin(noiDung);
    expect(kq.trangThai).toBeNull();
  });
});
