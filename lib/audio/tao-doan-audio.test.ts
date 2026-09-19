import { describe, it, expect } from 'vitest';
import { chuanHoaXml } from './tao-doan-audio';

describe('chuanHoaXml', () => {
  it('escape các ký tự đặc biệt XML', () => {
    expect(chuanHoaXml(`A & B < C > "D" 'E'`)).toBe('A &amp; B &lt; C &gt; &quot;D&quot; &apos;E&apos;');
  });
  it('giữ nguyên tiếng Việt có dấu', () => {
    expect(chuanHoaXml('Chương một')).toBe('Chương một');
  });
});
