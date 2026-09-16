import { describe, it, expect } from 'vitest';
import { chuanHoaXml } from './tao-audio-logic.mjs';

describe('tao-audio-logic - chuanHoaXml', () => {
  it('tra ve chuoi rong khi text rong hoac null/undefined', () => {
    expect(chuanHoaXml('')).toBe('');
    expect(chuanHoaXml(null)).toBe('');
    expect(chuanHoaXml(undefined)).toBe('');
  });

  it('chuan hoa dung cac ky tu dac biet XML', () => {
    const input = '<div class="test">Tom & Jerry\'s "adventure" > other</div>';
    const expected = '&lt;div class=&quot;test&quot;&gt;Tom &amp; Jerry&apos;s &quot;adventure&quot; &gt; other&lt;/div&gt;';
    expect(chuanHoaXml(input)).toBe(expected);
  });

  it('giu nguyen van ban binh thuong khong co ky tu dac biet', () => {
    const input = 'Chuong 1: Mo dau cau chuyen';
    expect(chuanHoaXml(input)).toBe(input);
  });
});
