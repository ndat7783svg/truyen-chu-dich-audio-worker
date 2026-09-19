import { describe, it, expect } from 'vitest';
import { xinSlotTaoDoan, traSlotTaoDoan, choPhepTheoGioiHan, type BoDem } from './gioi-han-audio';

function taoRedisGia(): BoDem & { gia: Map<string, number> } {
  const gia = new Map<string, number>();
  return {
    gia,
    async incr(k) { const v = (gia.get(k) ?? 0) + 1; gia.set(k, v); return v; },
    async decr(k) { const v = (gia.get(k) ?? 0) - 1; gia.set(k, v); return v; },
    async expire() { return 1; },
    async set(k, v) { gia.set(k, Number(v)); return 'OK'; },
  };
}

describe('xinSlotTaoDoan / traSlotTaoDoan', () => {
  it('cho phép tới mức tối đa rồi từ chối, và không làm đếm lệch khi từ chối', async () => {
    const redis = taoRedisGia();
    expect(await xinSlotTaoDoan(redis, 2)).toBe(true);
    expect(await xinSlotTaoDoan(redis, 2)).toBe(true);
    expect(await xinSlotTaoDoan(redis, 2)).toBe(false);
    expect([...redis.gia.values()][0]).toBe(2); // lần từ chối đã tự hoàn lại
  });

  it('trả slot thì có chỗ cho người sau', async () => {
    const redis = taoRedisGia();
    await xinSlotTaoDoan(redis, 1);
    expect(await xinSlotTaoDoan(redis, 1)).toBe(false);
    await traSlotTaoDoan(redis);
    expect(await xinSlotTaoDoan(redis, 1)).toBe(true);
  });

  it('không để bộ đếm xuống âm (trường hợp khoá hết hạn trước khi trả)', async () => {
    const redis = taoRedisGia();
    await traSlotTaoDoan(redis);
    expect([...redis.gia.values()][0]).toBe(0);
  });

  it('Redis lỗi -> fail-open (cho phép), không ném lỗi', async () => {
    const hong: BoDem = {
      async incr() { throw new Error('mat ket noi'); },
      async decr() { throw new Error('mat ket noi'); },
      async expire() { throw new Error('mat ket noi'); },
      async set() { throw new Error('mat ket noi'); },
    };
    expect(await xinSlotTaoDoan(hong, 1)).toBe(true);
    await expect(traSlotTaoDoan(hong)).resolves.toBeUndefined();
  });
});

describe('choPhepTheoGioiHan', () => {
  it('không có IP -> cho phép', async () => {
    expect(await choPhepTheoGioiHan({ limit: async () => ({ success: false }) as never }, null)).toBe(true);
  });
  it('vượt giới hạn -> false', async () => {
    expect(await choPhepTheoGioiHan({ limit: async () => ({ success: false }) as never }, '1.2.3.4')).toBe(false);
  });
  it('trong giới hạn -> true; limiter lỗi -> true (fail-open)', async () => {
    expect(await choPhepTheoGioiHan({ limit: async () => ({ success: true }) as never }, '1.2.3.4')).toBe(true);
    expect(
      await choPhepTheoGioiHan({ limit: async () => { throw new Error('x'); } }, '1.2.3.4')
    ).toBe(true);
  });
});

describe('hạn của bộ đếm đồng thời', () => {
  it('chỉ đặt hạn khi khoá chưa có hạn (NX) - không gia hạn mỗi lần để slot rò rỉ tự hết', async () => {
    const goiExpire: Array<string | undefined> = [];
    const redis = taoRedisGia();
    const goc = redis.expire.bind(redis);
    redis.expire = async (k, s, option) => {
      goiExpire.push(option);
      return goc(k, s);
    };
    await xinSlotTaoDoan(redis, 5);
    await xinSlotTaoDoan(redis, 5);
    expect(goiExpire).toEqual(['NX', 'NX']);
  });
});
