import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const KHOA_CACHE_IP_BOT = 'danh_sach_ip_bot_that';
const TTL_CACHE_GIAY = 60 * 60 * 24; // 24h

export async function layDanhSachIpBotThat(redis: Redis): Promise<string[]> {
  try {
    const cache = await redis.get<string[]>(KHOA_CACHE_IP_BOT);
    if (cache) return cache;

    const [resGoogle, resBing] = await Promise.all([
      fetch('https://developers.google.com/static/search/apis/ipranges/googlebot.json'),
      fetch('https://www.bing.com/toolbox/bingbot.json'),
    ]);
    const [textGoogle, textBing] = await Promise.all([resGoogle.text(), resBing.text()]);

    const regexCidr = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}/g;
    const danhSach = [
      ...(textGoogle.match(regexCidr) ?? []),
      ...(textBing.match(regexCidr) ?? []),
    ];

    await redis.set(KHOA_CACHE_IP_BOT, danhSach, { ex: TTL_CACHE_GIAY });
    return danhSach;
  } catch {
    return [];
  }
}

export function taoRateLimiter(redis: Redis): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '10 s'),
    prefix: 'gioi_han_truyen',
  });
}
