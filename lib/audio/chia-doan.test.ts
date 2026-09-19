import { describe, it, expect } from 'vitest';
import {
  chiaDoan,
  uocThoiLuongGiay,
  GIOI_HAN_DOAN_DAU,
  GIOI_HAN_DOAN_SAU,
  GIOI_HAN_CUNG,
} from './chia-doan';

const chuanHoa = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('chiaDoan', () => {
  it('chương chỉ có tiêu đề vẫn ra ít nhất 1 đoạn', () => {
    const kq = chiaDoan('Chương 1: Mở đầu', '');
    expect(kq.length).toBe(1);
    expect(kq[0]).toContain('Chương 1: Mở đầu');
  });

  it('đoạn đầu ngắn hơn các đoạn sau', () => {
    const cau = 'Anh ấy bước đi trong màn đêm yên tĩnh và lạnh lẽo. ';
    const kq = chiaDoan('Chương 2', cau.repeat(30));
    expect(kq.length).toBeGreaterThan(2);
    expect(kq[0].length).toBeLessThanOrEqual(GIOI_HAN_DOAN_DAU);
    kq.slice(1).forEach((d) => expect(d.length).toBeLessThanOrEqual(GIOI_HAN_DOAN_SAU));
  });

  it('ghép lại đúng nội dung gốc (không mất/thêm chữ)', () => {
    const noiDung = 'Câu một. Câu hai dài hơn một chút! Câu ba? “Câu bốn.”\nDòng mới bắt đầu ở đây. '.repeat(20);
    const kq = chiaDoan('Chương 3: Thử', noiDung);
    expect(chuanHoa(kq.join(' '))).toBe(chuanHoa(`Chương 3: Thử. ${noiDung}`));
  });

  it('câu dài không dấu chấm bị cắt cứng, không đoạn nào vượt giới hạn cứng', () => {
    const tuDai = 'chữ '.repeat(200); // ~800 ký tự, không có dấu câu
    const kq = chiaDoan('Chương 4', tuDai);
    kq.forEach((d) => expect(d.length).toBeLessThanOrEqual(GIOI_HAN_CUNG));
    expect(kq.length).toBeGreaterThan(3);
  });

  it('xác định: cùng đầu vào luôn ra cùng danh sách đoạn', () => {
    const noiDung = 'Một câu. Hai câu. Ba câu. '.repeat(50);
    expect(chiaDoan('T', noiDung)).toEqual(chiaDoan('T', noiDung));
  });
});

describe('uocThoiLuongGiay', () => {
  it('đoạn rỗng vẫn có thời lượng cố định > 0', () => {
    expect(uocThoiLuongGiay('')).toBeCloseTo(0.73, 2);
  });

  it('đoạn 171 ký tự ≈ 10 + 0.73 giây', () => {
    expect(uocThoiLuongGiay('a'.repeat(171))).toBeCloseTo(10.73, 1);
  });
});
