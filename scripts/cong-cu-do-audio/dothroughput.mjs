// Mô phỏng 1 người nghe 1.5x: lấy playlist chương, tải các đoạn theo đúng cách trình phát (tuần tự + nạp trước song song),
// đo thời gian tạo từng đoạn và so tốc độ tạo với tốc độ tiêu thụ.
const [, , tid, chuong, tuDoan = '0', denDoan = '40', songSong = '4'] = process.argv;
const goc = 'https://truyenchudich.site';
const pl = await (await fetch(`${goc}/api/audio/playlist.m3u8?t=${tid}&c=${chuong}`)).text();
const dong = pl.split('\n');
const doan = [];
for (let i = 0; i < dong.length; i++) {
  const m = dong[i].match(/^#EXTINF:([\d.]+)/);
  if (m) doan.push({ thoiLuong: parseFloat(m[1]), url: dong[i + 1].trim() });
}
const a = Number(tuDoan), b = Math.min(Number(denDoan), doan.length);
console.log(`chương ${chuong}: ${doan.length} đoạn, đo đoạn ${a}..${b - 1}, song song ${songSong}`);
const kq = [];
let kế = a;
const t0 = Date.now();
async function tho() {
  while (kế < b) {
    const i = kế++;
    const s = Date.now();
    let st = 0, tts = '', nk = '', cache = '';
    try {
      const r = await fetch(goc + doan[i].url);
      await r.arrayBuffer();
      st = r.status;
      tts = (r.headers.get('server-timing') || '').match(/tts;dur=(\d+)/)?.[1] || '';
      nk = r.headers.get('x-audio-nhat-ky') || '';
      cache = r.headers.get('x-vercel-cache') || '';
    } catch (e) { st = -1; }
    kq.push({ i, ms: Date.now() - s, st, tts, nk, cache, thoiLuong: doan[i].thoiLuong });
  }
}
await Promise.all(Array.from({ length: Number(songSong) }, tho));
const tong = (Date.now() - t0) / 1000;
kq.sort((x, y) => x.i - y.i);
const audioGiay = kq.filter(k => k.st === 200).reduce((t, k) => t + k.thoiLuong, 0);
const ms = kq.map(k => k.ms).sort((x, y) => x - y);
import("node:fs").then(f=>f.writeFileSync(process.env.OUT,JSON.stringify(kq)));
console.log(`tổng ${tong.toFixed(1)}s thực -> tạo ${audioGiay.toFixed(0)}s audio => tốc độ tạo ${(audioGiay / tong).toFixed(2)}x thời gian thực (nghe 1.5x cần >= 1.5x)`);
console.log(`độ trễ mỗi đoạn: trung vị ${ms[Math.floor(ms.length / 2)]}ms, p90 ${ms[Math.floor(ms.length * 0.9)]}ms, lớn nhất ${ms[ms.length - 1]}ms`);
console.log('trạng thái:', JSON.stringify(kq.reduce((o, k) => (o[k.st] = (o[k.st] || 0) + 1, o), {})), '| cache:', JSON.stringify(kq.reduce((o, k) => (o[k.cache] = (o[k.cache] || 0) + 1, o), {})));
console.log('chậm nhất:', kq.slice().sort((x, y) => y.ms - x.ms).slice(0, 5).map(k => `#${k.i}=${k.ms}ms(st${k.st},tts${k.tts},${k.nk.slice(0, 60)})`).join(' ; '));
