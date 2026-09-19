import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chayCoDuPhong, type CauHinhDuPhong } from './chay-co-du-phong';

const CAU_HINH: CauHinhDuPhong = {
  soLanToiDa: 3,
  hedgeSauMs: 6000,
  timeoutMotLanMs: 15000,
  nganSachTongMs: 52000,
  toiThieuMotLanMs: 5000,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('chayCoDuPhong', () => {
  it('lần đầu xong ngay -> trả kết quả, chỉ chạy 1 lần, không chạy dự phòng', async () => {
    const thuMot = vi.fn(async () => 'ok');
    await expect(chayCoDuPhong(thuMot, CAU_HINH)).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(20000);
    expect(thuMot).toHaveBeenCalledTimes(1);
  });

  it('lần đầu treo -> sau hedgeSauMs chạy thêm lần 2 song song và lấy kết quả lần 2', async () => {
    let lan = 0;
    const thuMot = vi.fn(() => {
      lan += 1;
      return lan === 1 ? new Promise<string>(() => {}) : Promise.resolve('tu-lan-2');
    });
    const kq = chayCoDuPhong(thuMot, CAU_HINH);
    await vi.advanceTimersByTimeAsync(5999);
    expect(thuMot).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    await expect(kq).resolves.toBe('tu-lan-2');
    expect(thuMot).toHaveBeenCalledTimes(2);
  });

  it('lần đầu lỗi -> thử lại NGAY (không đợi hedge)', async () => {
    let lan = 0;
    const thuMot = vi.fn(async () => {
      lan += 1;
      if (lan === 1) throw new Error('ngat giua chung');
      return 'ok-lan-2';
    });
    await expect(chayCoDuPhong(thuMot, CAU_HINH)).resolves.toBe('ok-lan-2');
    expect(thuMot).toHaveBeenCalledTimes(2);
  });

  it('mọi lần đều lỗi -> từ chối bằng lỗi cuối sau đúng soLanToiDa lần', async () => {
    let lan = 0;
    const thuMot = vi.fn(async () => {
      lan += 1;
      throw new Error(`loi-${lan}`);
    });
    await expect(chayCoDuPhong(thuMot, CAU_HINH)).rejects.toThrow('loi-3');
    expect(thuMot).toHaveBeenCalledTimes(3);
  });

  it('lần chạy chậm hơn nhưng về sau không ghi đè kết quả đã trả', async () => {
    let xongLan1: (v: string) => void = () => {};
    let lan = 0;
    const thuMot = vi.fn(() => {
      lan += 1;
      if (lan === 1) return new Promise<string>((r) => (xongLan1 = r));
      return Promise.resolve('lan-2');
    });
    const kq = chayCoDuPhong(thuMot, CAU_HINH);
    await vi.advanceTimersByTimeAsync(6001);
    await expect(kq).resolves.toBe('lan-2');
    xongLan1('lan-1-tre'); // về sau: không được gây lỗi
    await vi.advanceTimersByTimeAsync(100);
  });

  it('hết ngân sách thời gian thì không phát thêm lần nữa', async () => {
    const thuMot = vi.fn(() => new Promise<string>((_, loi) => setTimeout(() => loi(new Error('tre')), 20000)));
    const kq = chayCoDuPhong(thuMot, { ...CAU_HINH, nganSachTongMs: 22000, soLanToiDa: 5 });
    const bat = expect(kq).rejects.toThrow('tre');
    await vi.advanceTimersByTimeAsync(60000);
    await bat;
    expect(thuMot.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
