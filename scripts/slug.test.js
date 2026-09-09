import { describe, it, expect } from 'vitest';
import { taoSlug } from './slug.js';

describe('taoSlug', () => {
  it('bo dau tieng Viet, chuyen thanh chu thuong, noi bang gach ngang', () => {
    expect(taoSlug('Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái')).toBe(
      'ta-tu-hao-a-ta-tu-thang-cap-khoai'
    );
  });

  it('chuyen chu d co gach thanh d thuong', () => {
    expect(taoSlug('Đại Đạo Chí Tôn')).toBe('dai-dao-chi-ton');
  });

  it('gop nhieu khoang trang lien tiep thanh 1 gach ngang', () => {
    expect(taoSlug('Truyen   Test  Nhieu Khoang Trang')).toBe(
      'truyen-test-nhieu-khoang-trang'
    );
  });
});
