// Mô phỏng người nghe 1.5x với độ trễ lấy mẫu từ số đo thật. Đếm số lần đứng + tổng thời gian đứng qua N đoạn.
import fs from 'node:fs';
const mau = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); // {ms, st, thoiLuong}
const tocDo = 1.5, SO_DOAN = 400;
function chay(L, C, batDauDem, huyLoi) {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const lay = () => mau[Math.floor(rnd() * mau.length)];
  // trạng thái mỗi đoạn: undefined | {xong: thời điểm} | 'dang'
  const xong = new Array(SO_DOAN).fill(null);
  const dangChay = []; // {i, ket}
  const daPhat = new Set();
  let t = 0, player = 0, dangPhat = false, batDau = false, stalls = 0, tongDung = 0, cuoiDung = 0;
  let phatT = 0; // thời điểm đoạn hiện tại bắt đầu phát
  const thoiLuongWall = i => (mau[i % mau.length].thoiLuong) / tocDo;
  const lenLich = () => {
    // nạp trước: các đoạn player+1..player+L (và chính đoạn hls.js đang cần = player), tối đa C song song
    for (let sn = player; sn <= player + L; sn++) {
      if (dangChay.length >= C) break;
      if (sn >= SO_DOAN || xong[sn] !== null || daPhat.has(sn)) continue;
      const m = lay();
      daPhat.add(sn);
      dangChay.push({ i: sn, ket: t + m.ms / 1000, loi: m.st !== 200 });
    }
  };
  lenLich();
  // chờ đệm ban đầu: phát khi đoạn 0..(batDauDem-1) xong
  while (true) {
    // xử lý sự kiện kế tiếp: hoàn thành 1 request
    dangChay.sort((a, b) => a.ket - b.ket);
    const sk = dangChay[0] || { ket: Infinity };
    if (!dangChay[0] && !dangPhat) break;
    // nếu player đang phát và đoạn kế cần phát trước sk.ket -> xử lý phát trước
    // đơn giản hoá: xác định thời điểm player kết thúc đoạn hiện tại
    let tKetDoan = Infinity;
    if (dangPhat) tKetDoan = phatT + thoiLuongWall(player);
    if (dangPhat && tKetDoan <= sk.ket) {
      t = tKetDoan; player++; if (player >= SO_DOAN) break;
      if (xong[player] !== null && xong[player] <= t) { phatT = t; } else { dangPhat = false; stalls++; cuoiDung = t; }
      lenLich();
      continue;
    }
    t = sk.ket; dangChay.shift();
    if (sk.loi) { daPhat.delete(sk.i); } else { xong[sk.i] = t; }
    if (!batDau) {
      let du = true; for (let i = 0; i < batDauDem; i++) if (xong[i] === null) du = false;
      if (du) { batDau = true; dangPhat = true; phatT = t; }
    } else if (!dangPhat && xong[player] !== null) {
      tongDung += t - cuoiDung; dangPhat = true; phatT = t;
    }
    lenLich();
  }
  const thoiGianNghe = t;
  return { stalls, tongDung: +tongDung.toFixed(0), tongPhut: +(thoiGianNghe / 60).toFixed(1), moiPhutDung: +(stalls / (thoiGianNghe / 60)).toFixed(2) };
}
for (const [L, C] of [[4, 3], [8, 3], [12, 4], [16, 4], [20, 5], [24, 6]]) {
  console.log(`nạp trước ${String(L).padStart(2)} đoạn, ${C} song song:`, JSON.stringify(chay(L, C, 2)));
}
