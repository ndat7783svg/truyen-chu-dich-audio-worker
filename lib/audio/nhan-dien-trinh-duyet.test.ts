import { describe, it, expect } from 'vitest';
import { nenDungHlsGoc } from './nhan-dien-trinh-duyet';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
};

describe('nenDungHlsGoc', () => {
  it('iPhone (Safari hoặc Chrome iOS) và Safari macOS dùng HLS gốc', () => {
    expect(nenDungHlsGoc(UA.iphoneSafari)).toBe(true);
    expect(nenDungHlsGoc(UA.iphoneChrome)).toBe(true);
    expect(nenDungHlsGoc(UA.macSafari)).toBe(true);
  });

  it('Chrome/Edge/Android dùng hls.js', () => {
    expect(nenDungHlsGoc(UA.androidChrome)).toBe(false);
    expect(nenDungHlsGoc(UA.desktopChrome)).toBe(false);
    expect(nenDungHlsGoc(UA.edge)).toBe(false);
  });
});
