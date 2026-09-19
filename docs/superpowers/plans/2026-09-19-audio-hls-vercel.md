# Audio thật HLS trên Vercel — Implementation Plan

> **Cho người thực thi:** dự án này giao code cho Antigravity qua MCP (skill `delegate-antigravity-sk`); Claude
> lập plan, duyệt diff từng Task, chạy test/build thật, rồi tự review như kỹ sư trước khi báo xong. Các step
> dùng checkbox `- [ ]`. Mỗi Task kết thúc bằng 1 commit riêng.

**Goal:** Thay cách tạo audio "cả chương qua GitHub Actions" bằng luồng HLS: chia chương thành đoạn nhỏ,
tạo từng đoạn theo yêu cầu ngay trên Vercel (route handler), phát dần, tự chuyển chương liền mạch, không lưu
file audio lên Supabase.

**Architecture:** Route `manifest` (JSON) + `playlist.m3u8` liệt kê đoạn của chương hiện tại + tối đa 10 chương
kế; route `doan` tạo đúng 1 đoạn MP3 bằng `msedge-tts`, CDN Vercel giữ tạm đoạn của chương free. Chương
VIP (>50) cần "vé" HMAC trong URL đoạn và không cache chung. Rate limit theo IP + giới hạn đồng thời toàn site
qua Upstash. Trình phát client mới `ModalNgheAudioHls` dùng hls.js (Chrome/Android) hoặc HLS gốc
(Safari/iPhone), thay `ModalNgheAudioThat` (code cũ giữ nguyên, chỉ bỏ import).

**Tech Stack:** Next.js 16.3.4 App Router (route handlers), TypeScript, vitest, `msedge-tts` (đã có),
`@upstash/redis` + `@upstash/ratelimit` (đã có), `@supabase/supabase-js` (service role phía server), `hls.js` (mới).

Spec: `docs/superpowers/specs/2026-09-19-audio-hls-vercel-design.md`.

## Global Constraints

- **Next.js 16 có breaking changes** (CLAUDE.md): trước khi viết route handler đọc
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (params là `Promise`,
  dùng `NextRequest`/`Response`) và `.../02-route-segment-config/maxDuration.md`.
- Giọng `vi-VN-HoaiMyNeural`, định dạng `OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3` (như code cũ).
- Đoạn đầu mỗi chương tối đa **100** ký tự, các đoạn sau tối đa **200**, câu quá dài cắt cứng ở **250**.
- Ước lượng thời lượng đoạn = `số ký tự / 17.1 + 0.73` giây (hồi quy từ 17 mẫu đo thật 2026-09-19).
- Playlist = chương hiện tại + tối đa 10 chương kế (`SO_CHUONG_TOI_DA_TRONG_DANH_SACH = 11`).
- `SO_CHUONG_FREE = 50` lấy từ `lib/config/goi-vip.ts`. Chương ≤ 50 ai cũng nghe; chương > 50 cần đăng nhập + gói
  VIP còn hiệu lực. Server tự tính từ `so_chuong`, KHÔNG tin bất kỳ tham số nào client gửi về "chương này free".
- Đoạn chương free: `Cache-Control: public, max-age=3600, s-maxage=86400`. Đoạn chương VIP: `private, no-store`.
- Vé VIP: HMAC-SHA256 với `AUDIO_TICKET_SECRET`, hạn 6 giờ, gắn `truyenId|chuongToiDa|hetHan`.
- Giới hạn: playlist/manifest 30 lần / 10 phút / IP; đoạn 60 lần / phút / IP; đồng thời toàn site 20 đoạn
  (`GIOI_HAN_DOAN_DONG_THOI`). Upstash lỗi → fail-open (như `middleware.ts`).
- Đoạn lỗi: thử lại tối đa 3 lần (timeout 25s/lần); vẫn lỗi → HTTP 502. Quá tải → HTTP 503 + `Retry-After: 5`.
- **KHÔNG xoá** code/dữ liệu audio cũ (`ModalNgheAudioThat.tsx`, `actions-audio.ts`, workflow worker,
  `hang_doi_audio`, bucket `audio-chuong`, `chuong.audio_url`). KHÔNG đụng nút "Nghe (Giọng máy)".
- Tên hàm/biến tiếng Việt không dấu như phần còn lại của dự án; comment tiếng Việt có dấu.
- Lệnh test: `npx vitest run <đường dẫn>`; build: `npm run build`.

## Cấu trúc file

| File | Việc |
|---|---|
| `lib/audio/chia-doan.ts` (+test) | Chia chương thành đoạn, ước lượng thời lượng (thuần) |
| `lib/audio/nhan-dien-trinh-duyet.ts` (+test) | Safari/iOS → HLS gốc, còn lại → hls.js (thuần) |
| `lib/audio/ve-audio.ts` (+test) | Tạo/kiểm vé HMAC cho đoạn VIP (thuần) |
| `lib/audio/danh-sach-phat.ts` (+test) | Lọc chương theo quyền + dựng m3u8 + manifest (thuần) |
| `lib/audio/tham-so.ts` (+test) | Đọc/kiểm tra tham số query (thuần) |
| `lib/rate-limit/gioi-han-audio.ts` (+test) | Rate limit IP + bộ đếm đồng thời |
| `lib/audio/tao-doan-audio.ts` (+test phần XML) | Gọi `msedge-tts` tạo 1 đoạn, tự thử lại |
| `lib/audio/du-lieu-chuong.ts` | Đọc chương (service role) + quyền nghe của người gọi |
| `lib/audio/xay-danh-sach-phat.ts` | Ghép các phần trên thành 1 kết quả cho 2 route |
| `app/api/audio/manifest/route.ts` | JSON: danh sách chương + mốc thời gian |
| `app/api/audio/playlist.m3u8/route.ts` | Playlist HLS |
| `app/api/audio/doan/route.ts` | Tạo 1 đoạn MP3 |
| `middleware.ts`, `next.config.ts` | Loại `/api/audio/doan` khỏi middleware; `serverExternalPackages` |
| `app/truyen/[slug]/chuong/[so]/ModalNgheAudioHls.tsx` | Trình phát client mới |
| `.../PanelDocAudio.tsx`, `.../KhungDocChuong.tsx` | Đổi sang modal mới, truyền thêm `soChuongTruoc` |

---

### Task 1: Chia đoạn + ước lượng thời lượng + nhận diện trình duyệt

**Files:**
- Create: `lib/audio/chia-doan.ts`, `lib/audio/chia-doan.test.ts`
- Create: `lib/audio/nhan-dien-trinh-duyet.ts`, `lib/audio/nhan-dien-trinh-duyet.test.ts`

**Interfaces:**
- Produces: `chiaDoan(tieuDe: string, noiDung: string): string[]`, `uocThoiLuongGiay(doan: string): number`,
  hằng `GIOI_HAN_DOAN_DAU=100`, `GIOI_HAN_DOAN_SAU=200`, `GIOI_HAN_CUNG=250`;
  `nenDungHlsGoc(userAgent: string): boolean`.

- [ ] **Step 1: Viết test chia đoạn** — `lib/audio/chia-doan.test.ts`

```ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run lib/audio/chia-doan.test.ts`
Expected: FAIL (không tìm thấy `./chia-doan`).

- [ ] **Step 3: Cài đặt** — `lib/audio/chia-doan.ts`

```ts
// Chia văn bản chương thành các đoạn nhỏ để tạo audio theo từng đoạn (HLS). Hàm phải XÁC ĐỊNH: route
// playlist và route đoạn cùng gọi chiaDoan() với cùng dữ liệu nên phải ra cùng danh sách đoạn.
export const GIOI_HAN_DOAN_DAU = 100; // đoạn đầu ngắn để bắt đầu phát sau ~1-5 giây
export const GIOI_HAN_DOAN_SAU = 200;
export const GIOI_HAN_CUNG = 250; // câu dài hơn mức này bị cắt cứng tại khoảng trắng

// Hồi quy từ 17 mẫu đo thật (msedge-tts, giọng HoaiMy): 0.0586 giây/ký tự + 0.73 giây cố định/đoạn.
const SO_KY_TU_MOI_GIAY = 17.1;
const GIAY_CO_DINH_MOI_DOAN = 0.73;

export function uocThoiLuongGiay(doan: string): number {
  return doan.length / SO_KY_TU_MOI_GIAY + GIAY_CO_DINH_MOI_DOAN;
}

function tachCau(vanBan: string): string[] {
  return vanBan
    .split(/(?<=[.!?…。！？”"])\s+|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function catCung(cau: string, toiDa: number): string[] {
  const ketQua: string[] = [];
  let conLai = cau;
  while (conLai.length > toiDa) {
    let viTri = conLai.lastIndexOf(' ', toiDa);
    if (viTri < toiDa / 2) viTri = toiDa; // không có khoảng trắng hợp lý → cắt thẳng
    ketQua.push(conLai.slice(0, viTri).trim());
    conLai = conLai.slice(viTri).trim();
  }
  if (conLai) ketQua.push(conLai);
  return ketQua;
}

export function chiaDoan(tieuDe: string, noiDung: string): string[] {
  const vanBan = `${tieuDe}. ${noiDung}`.replace(/[ \t]+/g, ' ').trim();
  const cacCau = tachCau(vanBan).flatMap((c) => catCung(c, GIOI_HAN_CUNG));

  const ketQua: string[] = [];
  let hienTai = '';
  for (const cau of cacCau) {
    const gioiHan = ketQua.length === 0 ? GIOI_HAN_DOAN_DAU : GIOI_HAN_DOAN_SAU;
    if (hienTai && hienTai.length + 1 + cau.length > gioiHan) {
      ketQua.push(hienTai);
      hienTai = cau;
    } else {
      hienTai = hienTai ? `${hienTai} ${cau}` : cau;
    }
  }
  if (hienTai) ketQua.push(hienTai);
  return ketQua;
}
```

- [ ] **Step 4: Chạy test chia đoạn, xác nhận PASS**

Run: `npx vitest run lib/audio/chia-doan.test.ts`
Expected: tất cả PASS. Nếu test "ghép lại đúng nội dung" lệch do dấu câu/khoảng trắng, sửa `chiaDoan`
(KHÔNG sửa test) sao cho không mất/thêm ký tự.

- [ ] **Step 5: Viết test + cài đặt nhận diện trình duyệt**

`lib/audio/nhan-dien-trinh-duyet.test.ts`:
```ts
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
```
`lib/audio/nhan-dien-trinh-duyet.ts`:
```ts
// Chrome mới báo canPlayType HLS = "có" nhưng KHÔNG phát được đoạn MP3 thuần (đã gặp thật 2026-09-19),
// nên chọn theo user-agent thay vì canPlayType: Safari/iOS -> HLS gốc, còn lại -> hls.js.
export function nenDungHlsGoc(userAgent: string): boolean {
  const laIos = /iPad|iPhone|iPod/.test(userAgent);
  const laSafari =
    /safari/i.test(userAgent) && !/chrome|chromium|android|edg|crios|fxios/i.test(userAgent);
  return laIos || laSafari;
}
```

- [ ] **Step 6: Chạy cả 2 file test, xác nhận PASS**

Run: `npx vitest run lib/audio/chia-doan.test.ts lib/audio/nhan-dien-trinh-duyet.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/audio/chia-doan.ts lib/audio/chia-doan.test.ts lib/audio/nhan-dien-trinh-duyet.ts lib/audio/nhan-dien-trinh-duyet.test.ts
git commit -m "feat(audio-hls): chia đoạn chương, ước lượng thời lượng, nhận diện trình duyệt HLS"
```

---

### Task 2: Vé HMAC + đọc tham số

**Files:**
- Create: `lib/audio/ve-audio.ts`, `lib/audio/ve-audio.test.ts`
- Create: `lib/audio/tham-so.ts`, `lib/audio/tham-so.test.ts`

**Interfaces:**
- Produces:
  `type VeAudio = { chuongToiDa: number; hetHan: number; k: string }`;
  `taoVe(boMat: string, truyenId: string, chuongToiDa: number, hetHan: number): VeAudio`;
  `kiemVe(boMat: string, truyenId: string, ve: VeAudio, soChuong: number, bayGio?: number): boolean`
  (`hetHan`/`bayGio` là giây epoch);
  `docTruyenVaChuong(p: URLSearchParams): { truyenId: string; soChuong: number } | null`;
  `docChiSoDoan(p: URLSearchParams): number | null`;
  `docVe(p: URLSearchParams): VeAudio | null`.

- [ ] **Step 1: Test vé** — `lib/audio/ve-audio.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { taoVe, kiemVe } from './ve-audio';

const BI_MAT = 'bi-mat-thu-nghiem';
const TRUYEN = '11111111-1111-4111-8111-111111111111';
const BAY_GIO = 1_800_000_000;

describe('ve audio', () => {
  it('vé hợp lệ, chương trong phạm vi -> true', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 55, BAY_GIO)).toBe(true);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 60, BAY_GIO)).toBe(true);
  });

  it('chương vượt chuongToiDa -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 61, BAY_GIO)).toBe(false);
  });

  it('vé hết hạn -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO - 1);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 55, BAY_GIO)).toBe(false);
  });

  it('sai bí mật hoặc sai truyện -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe('bi-mat-khac', TRUYEN, ve, 55, BAY_GIO)).toBe(false);
    expect(kiemVe(BI_MAT, '22222222-2222-4222-8222-222222222222', ve, 55, BAY_GIO)).toBe(false);
  });

  it('sửa chuongToiDa hoặc hetHan (giả mạo) -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, chuongToiDa: 999 }, 500, BAY_GIO)).toBe(false);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, hetHan: BAY_GIO + 999999 }, 55, BAY_GIO)).toBe(false);
  });

  it('chữ ký sai định dạng/độ dài -> false, không ném lỗi', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, k: 'abc' }, 55, BAY_GIO)).toBe(false);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, k: '' }, 55, BAY_GIO)).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL** — `npx vitest run lib/audio/ve-audio.test.ts` → FAIL (chưa có module).

- [ ] **Step 3: Cài đặt** — `lib/audio/ve-audio.ts`

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

// "Vé" cho đoạn audio chương VIP: chỉ server biết bí mật nên client không tự tạo được. Vé gắn với
// truyện + chương lớn nhất được nghe + hạn dùng; route đoạn chỉ kiểm chữ ký (không gọi DB).
export type VeAudio = { chuongToiDa: number; hetHan: number; k: string };

function tinhChuKy(boMat: string, truyenId: string, chuongToiDa: number, hetHan: number): string {
  return createHmac('sha256', boMat).update(`${truyenId}|${chuongToiDa}|${hetHan}`).digest('hex');
}

export function taoVe(boMat: string, truyenId: string, chuongToiDa: number, hetHan: number): VeAudio {
  return { chuongToiDa, hetHan, k: tinhChuKy(boMat, truyenId, chuongToiDa, hetHan) };
}

export function kiemVe(
  boMat: string,
  truyenId: string,
  ve: VeAudio,
  soChuong: number,
  bayGio: number = Math.floor(Date.now() / 1000)
): boolean {
  if (ve.hetHan <= bayGio) return false;
  if (soChuong > ve.chuongToiDa) return false;
  const mong = Buffer.from(tinhChuKy(boMat, truyenId, ve.chuongToiDa, ve.hetHan), 'hex');
  const nhan = Buffer.from(ve.k, 'hex');
  if (nhan.length !== mong.length) return false;
  return timingSafeEqual(mong, nhan);
}
```

- [ ] **Step 4: Test tham số** — `lib/audio/tham-so.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { docTruyenVaChuong, docChiSoDoan, docVe } from './tham-so';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('docTruyenVaChuong', () => {
  it('hợp lệ', () => {
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=12`))).toEqual({ truyenId: UUID, soChuong: 12 });
  });
  it('thiếu / sai uuid / chương không phải số nguyên dương -> null', () => {
    expect(docTruyenVaChuong(new URLSearchParams('c=12'))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams('t=abc&c=12'))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=0`))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=1.5`))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=abc`))).toBeNull();
  });
});

describe('docChiSoDoan', () => {
  it('số nguyên >= 0', () => {
    expect(docChiSoDoan(new URLSearchParams('i=0'))).toBe(0);
    expect(docChiSoDoan(new URLSearchParams('i=37'))).toBe(37);
  });
  it('âm / thiếu / không phải số -> null', () => {
    expect(docChiSoDoan(new URLSearchParams('i=-1'))).toBeNull();
    expect(docChiSoDoan(new URLSearchParams(''))).toBeNull();
    expect(docChiSoDoan(new URLSearchParams('i=x'))).toBeNull();
  });
});

describe('docVe', () => {
  it('đủ h, m, k -> trả vé', () => {
    expect(docVe(new URLSearchParams('h=1800000000&m=60&k=abcdef12'))).toEqual({
      hetHan: 1800000000,
      chuongToiDa: 60,
      k: 'abcdef12',
    });
  });
  it('thiếu trường hoặc k không phải hex -> null', () => {
    expect(docVe(new URLSearchParams('h=1&m=60'))).toBeNull();
    expect(docVe(new URLSearchParams('h=1&m=60&k=zzzz'))).toBeNull();
  });
});
```

- [ ] **Step 5: Cài đặt** — `lib/audio/tham-so.ts`

```ts
import type { VeAudio } from './ve-audio';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_SO_NGUYEN = /^\d{1,9}$/;

export function docTruyenVaChuong(p: URLSearchParams): { truyenId: string; soChuong: number } | null {
  const t = p.get('t') ?? '';
  const c = p.get('c') ?? '';
  if (!REGEX_UUID.test(t) || !REGEX_SO_NGUYEN.test(c)) return null;
  const soChuong = Number(c);
  if (soChuong < 1) return null;
  return { truyenId: t, soChuong };
}

export function docChiSoDoan(p: URLSearchParams): number | null {
  const i = p.get('i') ?? '';
  return REGEX_SO_NGUYEN.test(i) ? Number(i) : null;
}

export function docVe(p: URLSearchParams): VeAudio | null {
  const h = p.get('h') ?? '';
  const m = p.get('m') ?? '';
  const k = p.get('k') ?? '';
  if (!REGEX_SO_NGUYEN.test(h) || !REGEX_SO_NGUYEN.test(m) || !/^[0-9a-f]{1,128}$/i.test(k)) return null;
  return { hetHan: Number(h), chuongToiDa: Number(m), k };
}
```

- [ ] **Step 6: Chạy test, xác nhận PASS** — `npx vitest run lib/audio/ve-audio.test.ts lib/audio/tham-so.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/audio/ve-audio.ts lib/audio/ve-audio.test.ts lib/audio/tham-so.ts lib/audio/tham-so.test.ts
git commit -m "feat(audio-hls): vé HMAC cho đoạn VIP và đọc/kiểm tra tham số query"
```

---

### Task 3: Danh sách phát HLS + ranh giới VIP (hàm thuần)

**Files:**
- Create: `lib/audio/danh-sach-phat.ts`, `lib/audio/danh-sach-phat.test.ts`

**Interfaces:**
- Consumes: `chiaDoan`, `uocThoiLuongGiay` (Task 1), `VeAudio` (Task 2), `SO_CHUONG_FREE`.
- Produces: các type `ChuongNguon`, `QuyenNghe`, `LyDoDungLai`, `DungLai`, `MucManifest`;
  `SO_CHUONG_TOI_DA_TRONG_DANH_SACH`; `chuongDuocNghe`, `locChuongDuocNghe`, `urlDoan`, `taoDanhSachPhat`
  (chữ ký ở dưới).

- [ ] **Step 1: Viết test** — `lib/audio/danh-sach-phat.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  locChuongDuocNghe,
  taoDanhSachPhat,
  urlDoan,
  type ChuongNguon,
} from './danh-sach-phat';

const TRUYEN = '11111111-1111-4111-8111-111111111111';
const VE = { chuongToiDa: 52, hetHan: 1800000000, k: 'abcdef' };

function chuong(so: number, noiDung = 'Câu một. Câu hai. Câu ba.'): ChuongNguon {
  return { chuongId: `id-${so}`, soChuong: so, tieuDe: `Chương ${so}`, noiDung };
}

describe('locChuongDuocNghe', () => {
  const ds = [chuong(49), chuong(50), chuong(51), chuong(52)];

  it('khách chưa đăng nhập: dừng trước chương 51, lý do chưa đăng nhập', () => {
    const kq = locChuongDuocNghe(ds, { daDangNhap: false, coVip: false });
    expect(kq.duocNghe.map((c) => c.soChuong)).toEqual([49, 50]);
    expect(kq.dungLai).toEqual({ soChuong: 51, lyDo: 'chua_dang_nhap' });
  });

  it('đã đăng nhập nhưng chưa VIP: lý do cần VIP', () => {
    const kq = locChuongDuocNghe(ds, { daDangNhap: true, coVip: false });
    expect(kq.dungLai).toEqual({ soChuong: 51, lyDo: 'can_vip' });
  });

  it('có VIP: nghe hết, không dừng', () => {
    const kq = locChuongDuocNghe(ds, { daDangNhap: true, coVip: true });
    expect(kq.duocNghe.length).toBe(4);
    expect(kq.dungLai).toBeNull();
  });

  it('chương hiện tại đã bị chặn: duocNghe rỗng', () => {
    const kq = locChuongDuocNghe([chuong(80)], { daDangNhap: false, coVip: false });
    expect(kq.duocNghe).toEqual([]);
    expect(kq.dungLai?.soChuong).toBe(80);
  });
});

describe('urlDoan', () => {
  it('chương free không kèm vé (để CDN dùng chung)', () => {
    expect(urlDoan(TRUYEN, 50, 3, VE)).toBe(`/api/audio/doan?t=${TRUYEN}&c=50&i=3`);
  });
  it('chương VIP kèm vé', () => {
    expect(urlDoan(TRUYEN, 51, 0, VE)).toBe(
      `/api/audio/doan?t=${TRUYEN}&c=51&i=0&h=1800000000&m=52&k=abcdef`
    );
  });
  it('chương VIP mà thiếu vé thì không tự bịa vé', () => {
    expect(urlDoan(TRUYEN, 51, 0, null)).toBe(`/api/audio/doan?t=${TRUYEN}&c=51&i=0`);
  });
});

describe('taoDanhSachPhat', () => {
  it('mốc thời gian và chỉ số đoạn toàn cục liên tục giữa các chương', () => {
    const { chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1), chuong(2)], null, null);
    expect(chuongs[0].batDauGiay).toBe(0);
    expect(chuongs[0].doanBatDau).toBe(0);
    expect(chuongs[1].batDauGiay).toBeCloseTo(chuongs[0].thoiLuongGiay, 5);
    expect(chuongs[1].doanBatDau).toBe(chuongs[0].soDoan);
  });

  it('soChuongSau: chương kế trong danh sách, chương cuối lấy từ chuongSauCuoi', () => {
    const { chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1), chuong(2)], null, { chuongId: 'id-3', soChuong: 3 });
    expect(chuongs[0].soChuongSau).toBe(2);
    expect(chuongs[0].chuongIdSau).toBe('id-2');
    expect(chuongs[1].soChuongSau).toBe(3);
    expect(chuongs[1].chuongIdSau).toBe('id-3');
  });

  it('chuongSauCuoi null: chương cuối không có soChuongSau', () => {
    const { chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1)], null, null);
    expect(chuongs[0].soChuongSau).toBeUndefined();
  });

  it('m3u8 đúng định dạng VOD, kết thúc bằng ENDLIST, targetduration >= mọi EXTINF', () => {
    const noiDung = 'Một câu khá dài để tạo nhiều đoạn khác nhau trong chương. '.repeat(20);
    const { m3u8, chuongs } = taoDanhSachPhat(TRUYEN, [chuong(1, noiDung)], null, null);
    const dong = m3u8.trim().split('\n');
    expect(dong[0]).toBe('#EXTM3U');
    expect(dong).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(dong[dong.length - 1]).toBe('#EXT-X-ENDLIST');

    const target = Number(dong.find((d) => d.startsWith('#EXT-X-TARGETDURATION:'))!.split(':')[1]);
    const cacExtinf = dong.filter((d) => d.startsWith('#EXTINF:')).map((d) => Number(d.slice(8, -1)));
    expect(cacExtinf.length).toBe(chuongs[0].soDoan);
    cacExtinf.forEach((t) => expect(t).toBeLessThanOrEqual(target));
  });

  it('URL đoạn theo đúng thứ tự (c, i) và chỉ chương >50 mang vé', () => {
    const { m3u8 } = taoDanhSachPhat(TRUYEN, [chuong(50), chuong(51)], VE, null);
    const urls = m3u8.split('\n').filter((d) => d.startsWith('/api/audio/doan'));
    const url50 = urls.filter((u) => u.includes('&c=50&'));
    const url51 = urls.filter((u) => u.includes('&c=51&'));
    expect(url50.length).toBeGreaterThan(0);
    expect(url51.length).toBeGreaterThan(0);
    url50.forEach((u) => expect(u).not.toContain('&k='));
    url51.forEach((u) => expect(u).toContain('&k=abcdef'));
    expect(urls[0]).toContain('&c=50&i=0');
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL** — `npx vitest run lib/audio/danh-sach-phat.test.ts` → FAIL.

- [ ] **Step 3: Cài đặt** — `lib/audio/danh-sach-phat.ts`

```ts
import { chiaDoan, uocThoiLuongGiay } from './chia-doan';
import type { VeAudio } from './ve-audio';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';

export const SO_CHUONG_TOI_DA_TRONG_DANH_SACH = 11; // chương hiện tại + 10 chương kế tiếp

export type ChuongNguon = { chuongId: string; soChuong: number; tieuDe: string; noiDung: string };
export type QuyenNghe = { daDangNhap: boolean; coVip: boolean };
export type LyDoDungLai = 'chua_dang_nhap' | 'can_vip';
export type DungLai = { soChuong: number; lyDo: LyDoDungLai };

export type MucManifest = {
  chuongId: string;
  soChuong: number;
  tieuDe: string;
  batDauGiay: number; // mốc bắt đầu chương trong toàn playlist (giây, ước lượng)
  thoiLuongGiay: number; // thời lượng chương (giây, ước lượng)
  soDoan: number;
  doanBatDau: number; // chỉ số đoạn toàn cục đầu tiên của chương (khớp `sn` của hls.js)
  soChuongSau?: number;
  chuongIdSau?: string;
};

export function chuongDuocNghe(soChuong: number, quyen: QuyenNghe): boolean {
  return soChuong <= SO_CHUONG_FREE || quyen.coVip;
}

// Lấy các chương liên tiếp từ đầu danh sách cho tới khi gặp chương đầu tiên không được nghe.
export function locChuongDuocNghe(
  danhSach: ChuongNguon[],
  quyen: QuyenNghe
): { duocNghe: ChuongNguon[]; dungLai: DungLai | null } {
  const duocNghe: ChuongNguon[] = [];
  for (const c of danhSach) {
    if (!chuongDuocNghe(c.soChuong, quyen)) {
      return {
        duocNghe,
        dungLai: { soChuong: c.soChuong, lyDo: quyen.daDangNhap ? 'can_vip' : 'chua_dang_nhap' },
      };
    }
    duocNghe.push(c);
  }
  return { duocNghe, dungLai: null };
}

export function urlDoan(truyenId: string, soChuong: number, chiSo: number, ve: VeAudio | null): string {
  let url = `/api/audio/doan?t=${truyenId}&c=${soChuong}&i=${chiSo}`;
  // Chương free KHÔNG mang vé để URL giống nhau giữa mọi người -> CDN lưu tạm dùng chung.
  if (soChuong > SO_CHUONG_FREE && ve) url += `&h=${ve.hetHan}&m=${ve.chuongToiDa}&k=${ve.k}`;
  return url;
}

export function taoDanhSachPhat(
  truyenId: string,
  chuongs: ChuongNguon[],
  ve: VeAudio | null,
  chuongSauCuoi: { chuongId: string; soChuong: number } | null
): { m3u8: string; chuongs: MucManifest[] } {
  const manifest: MucManifest[] = [];
  const cacDoan: { thoiLuong: number; url: string }[] = [];
  let tichLuyGiay = 0;

  chuongs.forEach((c, k) => {
    const doan = chiaDoan(c.tieuDe, c.noiDung);
    const thoiLuongDoan = doan.map(uocThoiLuongGiay);
    const thoiLuongChuong = thoiLuongDoan.reduce((a, b) => a + b, 0);
    const sau = chuongs[k + 1] ?? chuongSauCuoi ?? null;

    manifest.push({
      chuongId: c.chuongId,
      soChuong: c.soChuong,
      tieuDe: c.tieuDe,
      batDauGiay: tichLuyGiay,
      thoiLuongGiay: thoiLuongChuong,
      soDoan: doan.length,
      doanBatDau: cacDoan.length,
      soChuongSau: sau?.soChuong,
      chuongIdSau: sau?.chuongId,
    });

    doan.forEach((_, i) => {
      cacDoan.push({ thoiLuong: thoiLuongDoan[i], url: urlDoan(truyenId, c.soChuong, i, ve) });
    });
    tichLuyGiay += thoiLuongChuong;
  });

  const target = Math.max(1, Math.ceil(Math.max(...cacDoan.map((d) => d.thoiLuong))));
  const dong = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${target}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];
  for (const d of cacDoan) {
    dong.push(`#EXTINF:${d.thoiLuong.toFixed(3)},`, d.url);
  }
  dong.push('#EXT-X-ENDLIST');

  return { m3u8: dong.join('\n') + '\n', chuongs: manifest };
}
```

- [ ] **Step 4: Chạy, xác nhận PASS** — `npx vitest run lib/audio/danh-sach-phat.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/audio/danh-sach-phat.ts lib/audio/danh-sach-phat.test.ts
git commit -m "feat(audio-hls): dựng playlist HLS + manifest và lọc chương theo quyền nghe"
```

---

### Task 4: Giới hạn tốc độ/đồng thời + tạo đoạn audio

**Files:**
- Create: `lib/rate-limit/gioi-han-audio.ts`, `lib/rate-limit/gioi-han-audio.test.ts`
- Create: `lib/audio/tao-doan-audio.ts`, `lib/audio/tao-doan-audio.test.ts`

**Interfaces:**
- Produces:
  `GIOI_HAN_DOAN_DONG_THOI = 20`; `type BoDem`;
  `xinSlotTaoDoan(redis: BoDem, toiDa?: number): Promise<boolean>`; `traSlotTaoDoan(redis: BoDem): Promise<void>`;
  `taoGioiHanPlaylist(redis: Redis): Ratelimit`; `taoGioiHanDoan(redis: Redis): Ratelimit`;
  `choPhepTheoGioiHan(rl: Pick<Ratelimit,'limit'>, ip: string | null): Promise<boolean>` (fail-open);
  `chuanHoaXml(s: string): string`; `taoDoanAudio(vanBan: string): Promise<Buffer>` (thử lại tối đa 3 lần).

- [ ] **Step 1: Test bộ đếm đồng thời + fail-open** — `lib/rate-limit/gioi-han-audio.test.ts`

```ts
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
```

- [ ] **Step 2: Chạy, xác nhận FAIL** — `npx vitest run lib/rate-limit/gioi-han-audio.test.ts` → FAIL.

- [ ] **Step 3: Cài đặt** — `lib/rate-limit/gioi-han-audio.ts`

```ts
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Benchmark cũ: 30 cuộc gọi TTS song song = 0 lỗi, 70 song song = ~53% lỗi -> chốt trần 20 toàn site.
export const GIOI_HAN_DOAN_DONG_THOI = 20;
const KHOA_DEM_DONG_THOI = 'audio_dang_tao_doan';
const TTL_DEM_GIAY = 90; // phòng trường hợp hàm chết giữa chừng làm bộ đếm kẹt

export type BoDem = {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  set(key: string, value: number, opts?: { ex: number }): Promise<unknown>;
};

// Xin 1 "chỗ" tạo đoạn. Trả false nếu toàn site đang tạo quá nhiều đoạn cùng lúc. Fail-open khi Redis lỗi.
export async function xinSlotTaoDoan(redis: BoDem, toiDa: number = GIOI_HAN_DOAN_DONG_THOI): Promise<boolean> {
  try {
    const soDangTao = await redis.incr(KHOA_DEM_DONG_THOI);
    await redis.expire(KHOA_DEM_DONG_THOI, TTL_DEM_GIAY);
    if (soDangTao > toiDa) {
      await redis.decr(KHOA_DEM_DONG_THOI);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function traSlotTaoDoan(redis: BoDem): Promise<void> {
  try {
    const conLai = await redis.decr(KHOA_DEM_DONG_THOI);
    if (conLai < 0) await redis.set(KHOA_DEM_DONG_THOI, 0, { ex: TTL_DEM_GIAY });
  } catch {
    // bỏ qua: bộ đếm tự hết hạn sau TTL_DEM_GIAY
  }
}

export function taoGioiHanPlaylist(redis: Redis): Ratelimit {
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '10 m'), prefix: 'gioi_han_audio_playlist' });
}

export function taoGioiHanDoan(redis: Redis): Ratelimit {
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'gioi_han_audio_doan' });
}

export async function choPhepTheoGioiHan(rl: Pick<Ratelimit, 'limit'>, ip: string | null): Promise<boolean> {
  if (!ip) return true;
  try {
    return (await rl.limit(ip)).success;
  } catch {
    return true; // Upstash lỗi -> fail-open như middleware.ts
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS** — `npx vitest run lib/rate-limit/gioi-han-audio.test.ts` → PASS.
  (Nếu TypeScript báo `Redis` không khớp `BoDem` khi route truyền `Redis.fromEnv()`, chỉnh kiểu `BoDem` cho
  tương thích thay vì dùng `any`.)

- [ ] **Step 5: Test XML** — `lib/audio/tao-doan-audio.test.ts` (chỉ phần thuần, không gọi mạng)

```ts
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
```

- [ ] **Step 6: Cài đặt** — `lib/audio/tao-doan-audio.ts`

```ts
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const GIONG_DOC = 'vi-VN-HoaiMyNeural';
const TIMEOUT_MOT_LAN_MS = 25_000;
const SO_LAN_THU_TOI_DA = 3;

export function chuanHoaXml(vanBan: string): string {
  return vanBan
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// msedge-tts thỉnh thoảng treo/ngắt giữa chừng ("Stream closed before the synthesis completed") nên
// mỗi lần thử có timeout cứng và bao cả bước mở kết nối lẫn đọc stream.
async function taoMotLan(vanBan: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  let boDemGio: ReturnType<typeof setTimeout> | undefined;
  try {
    const ketQua = (async () => {
      await tts.setMetadata(GIONG_DOC, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(chuanHoaXml(vanBan));
      const cacManh: Buffer[] = [];
      return await new Promise<Buffer>((xong, loi) => {
        audioStream.on('data', (manh: Buffer) => cacManh.push(manh));
        audioStream.on('end', () => {
          const gop = Buffer.concat(cacManh);
          if (gop.length === 0) loi(new Error('Audio rỗng (0 byte)'));
          else xong(gop);
        });
        audioStream.on('error', loi);
      });
    })();
    const heoGio = new Promise<never>((_, loi) => {
      boDemGio = setTimeout(() => loi(new Error('Quá thời gian chờ TTS')), TIMEOUT_MOT_LAN_MS);
    });
    return await Promise.race([ketQua, heoGio]);
  } finally {
    if (boDemGio) clearTimeout(boDemGio);
    try {
      tts.close();
    } catch {
      // đã đóng
    }
  }
}

export async function taoDoanAudio(vanBan: string): Promise<Buffer> {
  let loiCuoi: unknown;
  for (let lan = 1; lan <= SO_LAN_THU_TOI_DA; lan += 1) {
    try {
      return await taoMotLan(vanBan);
    } catch (err) {
      loiCuoi = err;
      if (lan < SO_LAN_THU_TOI_DA) await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw loiCuoi instanceof Error ? loiCuoi : new Error(String(loiCuoi));
}
```

- [ ] **Step 7: Chạy test + kiểm tra kiểu**

Run: `npx vitest run lib/audio/tao-doan-audio.test.ts` → PASS. Sau đó `npx tsc --noEmit` → không lỗi ở 2 file mới.

- [ ] **Step 8: Commit**

```bash
git add lib/rate-limit/gioi-han-audio.ts lib/rate-limit/gioi-han-audio.test.ts lib/audio/tao-doan-audio.ts lib/audio/tao-doan-audio.test.ts
git commit -m "feat(audio-hls): giới hạn tốc độ/đồng thời và tạo đoạn audio msedge-tts có thử lại"
```

---

### Task 5: Nạp dữ liệu, 3 route handler, middleware, cấu hình

**Files:**
- Create: `lib/audio/du-lieu-chuong.ts`, `lib/audio/xay-danh-sach-phat.ts`
- Create: `app/api/audio/manifest/route.ts`, `app/api/audio/playlist.m3u8/route.ts`, `app/api/audio/doan/route.ts`
- Modify: `middleware.ts` (matcher), `next.config.ts`, `.env.local.example`

**Interfaces:**
- Consumes: mọi thứ từ Task 1-4; `taoSupabaseServerClient` (`lib/supabase/server.ts`), `conHieuLucGoi`
  (`lib/utils/gia-han-vip.ts`), `layIpTuHeader` (`lib/utils/xac-minh-bot.ts`), `SO_CHUONG_FREE`.
- Produces: `xayDanhSachPhat(truyenId, soChuong): Promise<KetQuaXay>` cho 2 route; 3 endpoint HTTP:
  - `GET /api/audio/manifest?t=<truyenId>&c=<soChuong>` → 200 JSON
    `{ playlistUrl, chuongs: MucManifest[], dungLai: DungLai|null, chuongSauCuoi: {chuongId,soChuong}|null }`;
    403 `{ lyDo }` nếu chương hiện tại không được nghe; 404 nếu không có chương; 429 quá nhanh.
  - `GET /api/audio/playlist.m3u8?t=&c=` → `application/vnd.apple.mpegurl`.
  - `GET /api/audio/doan?t=&c=&i=[&h=&m=&k=]` → `audio/mpeg`; 400/403/404/429/502/503.

- [ ] **Step 1: Đọc tài liệu Next.js 16** (bắt buộc, xem Global Constraints) rồi ghi vào commit message nếu có
  điểm khác biệt đã áp dụng.

- [ ] **Step 2: Cấu hình** 

`next.config.ts` — thêm `serverExternalPackages` (thư viện `msedge-tts` dùng WebSocket, không nên bị bundle):
```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['msedge-tts'],
  images: { /* giữ nguyên như hiện tại */ },
};
```
`middleware.ts` — loại đường dẫn tạo đoạn khỏi middleware (tránh gọi Supabase Auth cho mỗi đoạn và tránh
`Set-Cookie` làm hỏng cache CDN). Sửa dòng cuối file:
```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/audio/doan).*)'],
};
```
`.env.local.example` — thêm dòng `AUDIO_TICKET_SECRET=`. Thêm vào `.env.local` (không commit) một chuỗi ngẫu
nhiên dài, ví dụ tạo bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

- [ ] **Step 3: Nạp dữ liệu** — `lib/audio/du-lieu-chuong.ts`

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import type { ChuongNguon, QuyenNghe } from './danh-sach-phat';

type HangChuong = { id: string; so_chuong: number; tieu_de: string; noi_dung: string | null };

function sangChuongNguon(h: HangChuong): ChuongNguon {
  return { chuongId: h.id, soChuong: h.so_chuong, tieuDe: h.tieu_de, noiDung: h.noi_dung ?? '' };
}

// Service role: đọc được cột noi_dung (đã bị REVOKE với anon/authenticated). Chỉ dùng trong route server,
// và mọi quyết định "được nghe hay không" phải được kiểm TRƯỚC khi dùng dữ liệu này (xem xay-danh-sach-phat).
export function taoSupabaseDichVu(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const khoa = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !khoa) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, khoa, { auth: { persistSession: false } });
}

export async function layChuongTuSo(
  sb: SupabaseClient,
  truyenId: string,
  tuSoChuong: number,
  soLuong: number
): Promise<ChuongNguon[]> {
  const { data, error } = await sb
    .from('chuong')
    .select('id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyenId)
    .gte('so_chuong', tuSoChuong)
    .order('so_chuong', { ascending: true })
    .limit(soLuong);
  if (error) throw new Error(`Lỗi đọc chương: ${error.message}`);
  return ((data ?? []) as HangChuong[]).map(sangChuongNguon);
}

export async function layMotChuong(
  sb: SupabaseClient,
  truyenId: string,
  soChuong: number
): Promise<ChuongNguon | null> {
  const { data, error } = await sb
    .from('chuong')
    .select('id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyenId)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (error) throw new Error(`Lỗi đọc chương: ${error.message}`);
  return data ? sangChuongNguon(data as HangChuong) : null;
}

// Quyền của NGƯỜI GỌI, lấy từ cookie phiên đăng nhập (Supabase Auth) - không tin bất kỳ tham số nào từ client.
export async function layQuyenNghe(): Promise<QuyenNghe> {
  const sb = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { daDangNhap: false, coVip: false };
  const { data } = await sb.from('nguoi_dung').select('goi_het_han').eq('id', user.id).maybeSingle();
  return { daDangNhap: true, coVip: conHieuLucGoi(data?.goi_het_han ?? null) };
}
```

- [ ] **Step 4: Ghép danh sách** — `lib/audio/xay-danh-sach-phat.ts`

```ts
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import {
  SO_CHUONG_TOI_DA_TRONG_DANH_SACH,
  locChuongDuocNghe,
  taoDanhSachPhat,
  type DungLai,
  type MucManifest,
} from './danh-sach-phat';
import { layChuongTuSo, layQuyenNghe, taoSupabaseDichVu } from './du-lieu-chuong';
import { taoVe } from './ve-audio';

const HAN_VE_GIAY = 6 * 60 * 60;

export type KetQuaXay =
  | { loai: 'khong_co_chuong' }
  | { loai: 'bi_chan'; dungLai: DungLai }
  | {
      loai: 'ok';
      m3u8: string;
      manifest: {
        playlistUrl: string;
        chuongs: MucManifest[];
        dungLai: DungLai | null;
        chuongSauCuoi: { chuongId: string; soChuong: number } | null;
      };
    };

export async function xayDanhSachPhat(truyenId: string, soChuong: number): Promise<KetQuaXay> {
  const [quyen, danhSach] = await Promise.all([
    layQuyenNghe(),
    layChuongTuSo(taoSupabaseDichVu(), truyenId, soChuong, SO_CHUONG_TOI_DA_TRONG_DANH_SACH + 1),
  ]);
  if (danhSach.length === 0 || danhSach[0].soChuong !== soChuong) return { loai: 'khong_co_chuong' };

  const { duocNghe, dungLai } = locChuongDuocNghe(
    danhSach.slice(0, SO_CHUONG_TOI_DA_TRONG_DANH_SACH),
    quyen
  );
  if (duocNghe.length === 0 && dungLai) return { loai: 'bi_chan', dungLai };

  // Chương ngay sau chương cuối được nghe (có thể chính là chương bị chặn) - để hiện nút/tự chuyển chương.
  const tiepTheo = danhSach[duocNghe.length] ?? null;
  const chuongSauCuoi = tiepTheo ? { chuongId: tiepTheo.chuongId, soChuong: tiepTheo.soChuong } : null;

  let ve = null;
  const chuongCaoNhat = Math.max(...duocNghe.map((c) => c.soChuong));
  if (chuongCaoNhat > SO_CHUONG_FREE) {
    const boMat = process.env.AUDIO_TICKET_SECRET;
    if (!boMat) throw new Error('Thiếu AUDIO_TICKET_SECRET - từ chối tạo playlist chương VIP');
    ve = taoVe(boMat, truyenId, chuongCaoNhat, Math.floor(Date.now() / 1000) + HAN_VE_GIAY);
  }

  const { m3u8, chuongs } = taoDanhSachPhat(truyenId, duocNghe, ve, chuongSauCuoi);
  return {
    loai: 'ok',
    m3u8,
    manifest: {
      playlistUrl: `/api/audio/playlist.m3u8?t=${truyenId}&c=${soChuong}`,
      chuongs,
      dungLai,
      chuongSauCuoi,
    },
  };
}
```

- [ ] **Step 5: Route manifest** — `app/api/audio/manifest/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { layIpTuHeader } from '@/lib/utils/xac-minh-bot';
import { choPhepTheoGioiHan, taoGioiHanPlaylist } from '@/lib/rate-limit/gioi-han-audio';
import { docTruyenVaChuong } from '@/lib/audio/tham-so';
import { xayDanhSachPhat } from '@/lib/audio/xay-danh-sach-phat';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const tham = docTruyenVaChuong(request.nextUrl.searchParams);
  if (!tham) return NextResponse.json({ loi: 'tham_so_khong_hop_le' }, { status: 400 });

  const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
  if (!(await choPhepTheoGioiHan(taoGioiHanPlaylist(Redis.fromEnv()), ip))) {
    return NextResponse.json({ loi: 'qua_nhanh' }, { status: 429 });
  }

  try {
    const kq = await xayDanhSachPhat(tham.truyenId, tham.soChuong);
    if (kq.loai === 'khong_co_chuong') return NextResponse.json({ loi: 'khong_co_chuong' }, { status: 404 });
    if (kq.loai === 'bi_chan') {
      return NextResponse.json({ lyDo: kq.dungLai.lyDo, soChuong: kq.dungLai.soChuong }, { status: 403 });
    }
    return NextResponse.json(kq.manifest, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Lỗi manifest audio:', err);
    return NextResponse.json({ loi: 'loi_may_chu' }, { status: 500 });
  }
}
```
(`Redis.fromEnv()` ném lỗi nếu thiếu biến môi trường — bọc `taoGioiHanPlaylist(Redis.fromEnv())` trong
try/catch để fail-open cho đúng quy ước: nếu ném thì coi như được phép.)

- [ ] **Step 6: Route playlist** — `app/api/audio/playlist.m3u8/route.ts`

Cùng cấu trúc route manifest (cùng kiểm tham số + rate limit + `xayDanhSachPhat`), khác phần trả về:
```ts
if (kq.loai === 'khong_co_chuong') return new Response('Không có chương', { status: 404 });
if (kq.loai === 'bi_chan') return new Response('Cần đăng nhập/VIP', { status: 403 });
return new Response(kq.m3u8, {
  headers: {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'private, no-store',
  },
});
```
`export const maxDuration = 30;` như manifest. Lỗi 500/429/400 trả `new Response(..., { status })` dạng text.

- [ ] **Step 7: Route đoạn** — `app/api/audio/doan/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { layIpTuHeader } from '@/lib/utils/xac-minh-bot';
import {
  choPhepTheoGioiHan,
  taoGioiHanDoan,
  traSlotTaoDoan,
  xinSlotTaoDoan,
} from '@/lib/rate-limit/gioi-han-audio';
import { docChiSoDoan, docTruyenVaChuong, docVe } from '@/lib/audio/tham-so';
import { kiemVe } from '@/lib/audio/ve-audio';
import { chiaDoan } from '@/lib/audio/chia-doan';
import { layMotChuong, taoSupabaseDichVu } from '@/lib/audio/du-lieu-chuong';
import { taoDoanAudio } from '@/lib/audio/tao-doan-audio';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const tham = docTruyenVaChuong(p);
  const chiSo = docChiSoDoan(p);
  if (!tham || chiSo === null) return NextResponse.json({ loi: 'tham_so_khong_hop_le' }, { status: 400 });

  const laChuongVip = tham.soChuong > SO_CHUONG_FREE;
  if (laChuongVip) {
    const ve = docVe(p);
    const boMat = process.env.AUDIO_TICKET_SECRET;
    if (!ve || !boMat || !kiemVe(boMat, tham.truyenId, ve, tham.soChuong)) {
      return NextResponse.json({ loi: 've_khong_hop_le' }, { status: 403 });
    }
  }

  let redis: Redis | null = null;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null; // thiếu cấu hình Upstash -> fail-open
  }

  const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
  if (redis && !(await choPhepTheoGioiHan(taoGioiHanDoan(redis), ip))) {
    return NextResponse.json({ loi: 'qua_nhanh' }, { status: 429 });
  }

  try {
    const chuong = await layMotChuong(taoSupabaseDichVu(), tham.truyenId, tham.soChuong);
    if (!chuong) return NextResponse.json({ loi: 'khong_co_chuong' }, { status: 404 });
    const cacDoan = chiaDoan(chuong.tieuDe, chuong.noiDung);
    if (chiSo >= cacDoan.length) return NextResponse.json({ loi: 'khong_co_doan' }, { status: 404 });

    if (redis && !(await xinSlotTaoDoan(redis))) {
      return NextResponse.json({ loi: 'qua_tai' }, { status: 503, headers: { 'Retry-After': '5' } });
    }
    try {
      const mp3 = await taoDoanAudio(cacDoan[chiSo]);
      return new Response(new Uint8Array(mp3), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': laChuongVip
            ? 'private, no-store'
            : 'public, max-age=3600, s-maxage=86400',
        },
      });
    } finally {
      if (redis) await traSlotTaoDoan(redis);
    }
  } catch (err) {
    console.error('Lỗi tạo đoạn audio:', err);
    return NextResponse.json({ loi: 'tao_doan_that_bai' }, { status: 502 });
  }
}
```

- [ ] **Step 8: Build + kiểm tra route thật (dev server)**

Run: `npm run build` → build sạch, có 3 route `/api/audio/...` trong bảng route.
Run: `npm test` → toàn bộ test PASS (test cũ + mới).
Khởi động dev server bằng `preview_start` (không dùng Bash cho server). Lấy `truyenId` thật:
`node --env-file=.env.local -e "import('@supabase/supabase-js').then(async({createClient})=>{const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {data}=await s.from('truyen').select('id,ten').limit(1);console.log(data)})"`

Kiểm tra bằng `curl` (thay `<ID>`):
- `curl -s "http://localhost:3000/api/audio/manifest?t=<ID>&c=1"` → JSON có `chuongs` (11 mục), `playlistUrl`.
- `curl -s "http://localhost:3000/api/audio/playlist.m3u8?t=<ID>&c=1" | head -12` → bắt đầu `#EXTM3U`, có
  `#EXT-X-PLAYLIST-TYPE:VOD`, dòng URL `/api/audio/doan?...`.
- `curl -s -o t.mp3 -w "%{http_code} %{size_download} %{time_total}s\n" "http://localhost:3000/api/audio/doan?t=<ID>&c=1&i=0"` → `200`, vài chục KB.
- Chương VIP không vé: `curl -s -w "%{http_code}" "http://localhost:3000/api/audio/doan?t=<ID>&c=51&i=0"` → `403`.
- Chương VIP khách chưa đăng nhập qua manifest: `curl -s -w "\n%{http_code}" "http://localhost:3000/api/audio/manifest?t=<ID>&c=60"` → `403` + `chua_dang_nhap`;
  `c=45` → 200 với `dungLai.soChuong` = 51 và `chuongs` dừng ở chương 50.
- Tham số sai: `...doan?t=abc&c=1&i=0` → `400`.
- Rate limit: gọi manifest 35 lần liên tiếp → những lần cuối trả `429`.

- [ ] **Step 9: Commit**

```bash
git add lib/audio/du-lieu-chuong.ts lib/audio/xay-danh-sach-phat.ts app/api/audio next.config.ts middleware.ts .env.local.example
git commit -m "feat(audio-hls): route manifest/playlist/doan, kiểm quyền VIP, rate limit, loại khỏi middleware"
```

---

### Task 6: Trình phát client `ModalNgheAudioHls`

**Files:**
- Create: `app/truyen/[slug]/chuong/[so]/ModalNgheAudioHls.tsx`
- Modify: `app/truyen/[slug]/chuong/[so]/PanelDocAudio.tsx` (đổi import + props, dòng ~14, ~300-319)
- Modify: `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx` (truyền `soChuongTruoc`, dòng ~180-192)
- Modify: `package.json` (thêm `hls.js`)

**Interfaces:**
- Consumes: `GET /api/audio/manifest`, `nenDungHlsGoc`, `taoSupabaseClient`, RPC `lay_noi_dung_chuong`,
  `docCaiDatAudio/ghiCaiDatAudio/GIOI_HAN_TOC_DO`, type `ThongTinChuongMoi` (từ `KhungDocChuong.tsx`).
- Produces: component `ModalNgheAudioHls` với props:
  `{ moModal, onDong, chuongId, slugTruyen, tenTruyen, truyenId, soChuong, soChuongTruoc?, soChuongSau?,
  chuongIdSau?, tieuDe, onDungWebSpeech?, tuDongPhatNgay?, onChuyenChuongMoi? }`.

- [ ] **Step 1: Cài thư viện**

Run: `npm install hls.js` → `package.json` thêm `hls.js`. Xác nhận `npm ls hls.js` có phiên bản 1.x.

- [ ] **Step 2: Tạo component** — `app/truyen/[slug]/chuong/[so]/ModalNgheAudioHls.tsx`

Yêu cầu hành vi (đã kiểm chứng trên thiết bị thật ở thử nghiệm 2026-09-19):
- Bấm "Bắt đầu" phải chạy **đồng bộ trong cùng thao tác bấm**: gán nguồn + gọi `play()` ngay, KHÔNG `await`
  trước khi `play()` (iPhone chặn `play()` sau `await fetch`). Manifest được tải song song chỉ để dựng giao diện.
- Safari/iOS (`nenDungHlsGoc`) → `audio.src = playlistUrl`; còn lại → `import('hls.js')` động, nếu
  `!Hls.isSupported()` thì fallback gán `src`.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type HlsType from 'hls.js';
import { taoSupabaseClient } from '@/lib/supabase/client';
import { GIOI_HAN_TOC_DO, docCaiDatAudio, ghiCaiDatAudio } from '@/lib/utils/cai-dat-audio';
import { nenDungHlsGoc } from '@/lib/audio/nhan-dien-trinh-duyet';
import type { ThongTinChuongMoi } from './KhungDocChuong';

type MucChuong = {
  chuongId: string;
  soChuong: number;
  tieuDe: string;
  batDauGiay: number;
  thoiLuongGiay: number;
  soDoan: number;
  doanBatDau: number;
  soChuongSau?: number;
  chuongIdSau?: string;
};

type Manifest = {
  playlistUrl: string;
  chuongs: MucChuong[];
  dungLai: { soChuong: number; lyDo: 'chua_dang_nhap' | 'can_vip' } | null;
  chuongSauCuoi: { chuongId: string; soChuong: number } | null;
};

type TrangThai =
  | { loai: 'nghi' }
  | { loai: 'dangTai' }
  | { loai: 'phat' }
  | { loai: 'vip'; soChuong: number; lyDo: 'chua_dang_nhap' | 'can_vip' }
  | { loai: 'loi'; thongBao: string };

function dinhDangThoiGian(giay: number): string {
  if (!Number.isFinite(giay) || giay < 0) return '00:00';
  const phut = Math.floor(giay / 60);
  const s = Math.floor(giay % 60);
  return `${String(phut).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ModalNgheAudioHls({
  moModal,
  onDong,
  chuongId,
  slugTruyen,
  tenTruyen,
  truyenId,
  soChuong,
  soChuongTruoc,
  soChuongSau,
  tieuDe,
  onDungWebSpeech,
  tuDongPhatNgay,
  onChuyenChuongMoi,
}: {
  moModal: boolean;
  onDong: () => void;
  chuongId: string;
  slugTruyen: string;
  tenTruyen: string;
  truyenId: string;
  soChuong: number;
  soChuongTruoc?: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tieuDe: string;
  onDungWebSpeech?: () => void;
  tuDongPhatNgay?: boolean;
  onChuyenChuongMoi?: (thongTinMoi: ThongTinChuongMoi) => void;
}) {
  const [daMount, setDaMount] = useState(false);
  const [trangThai, setTrangThai] = useState<TrangThai>({ loai: 'nghi' });
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [chiSoChuong, setChiSoChuong] = useState(0);
  const [dangPhat, setDangPhat] = useState(false);
  const [thoiGian, setThoiGian] = useState(0); // currentTime toàn playlist
  const [tocDo, setTocDo] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const chiSoRef = useRef(0);
  const dungHlsGocRef = useRef(false);
  const tocDoRef = useRef(1);
  const soLanThuLaiMangRef = useRef(0);
  const daTuDongPhatRef = useRef(false);
  // chương mà UI đang hiển thị do CHÍNH modal này điều khiển; effect theo `chuongId` dùng để phân biệt
  // "modal tự đổi chương" (bỏ qua) với "người dùng bấm sang chương khác" (dừng audio).
  const chuongDangHienThiRef = useRef(chuongId);
  const soChuongTruocGocRef = useRef<number | undefined>(soChuongTruoc);

  useEffect(() => {
    setDaMount(true);
    const daLuu = docCaiDatAudio();
    setTocDo(daLuu.tocDo);
    tocDoRef.current = daLuu.tocDo;
    dungHlsGocRef.current = nenDungHlsGoc(navigator.userAgent);
    return () => dungNguon();
  }, []);

  function dungNguon() {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }

  function dungHoanToan() {
    dungNguon();
    manifestRef.current = null;
    setManifest(null);
    setDangPhat(false);
    setThoiGian(0);
    setTrangThai({ loai: 'nghi' });
  }

  // Người dùng tự bấm sang chương khác (không phải do modal tự đổi) -> dừng audio đang phát.
  useEffect(() => {
    if (chuongId === chuongDangHienThiRef.current) return;
    chuongDangHienThiRef.current = chuongId;
    dungHoanToan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chuongId]);

  function capNhatMediaSession(muc: MucChuong) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Chương ${muc.soChuong}: ${muc.tieuDe}`,
      artist: tenTruyen,
      album: tenTruyen,
    });
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => tuaGiay(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => tuaGiay(10));
    navigator.mediaSession.setActionHandler('nexttrack', () => nhayChuong(chiSoRef.current + 1));
  }

  // Đổi chữ hiển thị sang chương `chiSo` của playlist (audio vẫn chạy liên tục, chỉ đồng bộ giao diện).
  async function hienThiChuong(chiSo: number, ep = false) {
    const man = manifestRef.current;
    if (!man || chiSo < 0 || chiSo >= man.chuongs.length) return;
    if (chiSo === chiSoRef.current && !ep) return;
    chiSoRef.current = chiSo;
    setChiSoChuong(chiSo);
    const muc = man.chuongs[chiSo];
    capNhatMediaSession(muc);
    chuongDangHienThiRef.current = muc.chuongId;

    const { data: noiDung, error } = await taoSupabaseClient().rpc('lay_noi_dung_chuong', {
      p_chuong_id: muc.chuongId,
    });
    if (chiSoRef.current !== chiSo) return; // trong lúc chờ đã sang chương khác
    if (error || noiDung == null) return; // audio vẫn phát; chữ sẽ đồng bộ ở lần đổi chương sau
    onChuyenChuongMoi?.({
      chuongId: muc.chuongId,
      soChuong: muc.soChuong,
      tieuDe: muc.tieuDe,
      noiDung,
      soChuongTruoc: chiSo > 0 ? man.chuongs[chiSo - 1].soChuong : soChuongTruocGocRef.current,
      soChuongSau: muc.soChuongSau,
      chuongIdSau: muc.chuongIdSau,
    });
  }

  function chiSoTheoDoan(sn: number): number {
    const man = manifestRef.current;
    if (!man) return 0;
    for (let i = man.chuongs.length - 1; i >= 0; i -= 1) {
      if (sn >= man.chuongs[i].doanBatDau) return i;
    }
    return 0;
  }

  function chiSoTheoThoiGian(giay: number): number {
    const man = manifestRef.current;
    if (!man) return 0;
    for (let i = man.chuongs.length - 1; i >= 0; i -= 1) {
      if (giay >= man.chuongs[i].batDauGiay) return i;
    }
    return 0;
  }

  function tuaGiay(delta: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime + delta);
  }

  function nhayChuong(chiSo: number) {
    const man = manifestRef.current;
    const el = audioRef.current;
    if (!man || !el || chiSo < 0 || chiSo >= man.chuongs.length) return;
    el.currentTime = man.chuongs[chiSo].batDauGiay;
  }

  async function taiManifest(soChuongBatDau: number): Promise<Manifest | null> {
    try {
      const res = await fetch(`/api/audio/manifest?t=${truyenId}&c=${soChuongBatDau}`);
      if (res.status === 403) {
        const j = await res.json();
        dungNguon();
        setTrangThai({ loai: 'vip', soChuong: j.soChuong ?? soChuongBatDau, lyDo: j.lyDo });
        return null;
      }
      if (res.status === 429) {
        dungNguon();
        setTrangThai({ loai: 'loi', thongBao: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' });
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Manifest;
    } catch {
      dungNguon();
      setTrangThai({ loai: 'loi', thongBao: 'Không tải được danh sách phát. Kiểm tra mạng rồi bấm Thử lại.' });
      return null;
    }
  }

  // Bắt đầu phát từ chương `soChuongBatDau`. PHẢI gọi trực tiếp từ sự kiện bấm nút (xem ghi chú iPhone).
  function batDauPhat(soChuongBatDau: number, laTiepNoi = false) {
    const el = audioRef.current;
    if (!el) return;
    onDungWebSpeech?.();
    dungNguon();
    // Bỏ manifest cũ NGAY: nếu không, sự kiện FRAG_CHANGED của playlist mới (sn=0) sẽ bị map theo manifest
    // cũ và kéo giao diện về chương đầu của danh sách cũ (lỗi khi nạp tiếp playlist sau 11 chương).
    manifestRef.current = null;
    setManifest(null);
    setTrangThai({ loai: 'dangTai' });
    setThoiGian(0);
    soLanThuLaiMangRef.current = 0;
    if (!laTiepNoi) soChuongTruocGocRef.current = soChuongTruoc;

    const playlistUrl = `/api/audio/playlist.m3u8?t=${truyenId}&c=${soChuongBatDau}`;
    el.defaultPlaybackRate = tocDoRef.current;
    el.playbackRate = tocDoRef.current;

    if (dungHlsGocRef.current) {
      el.src = playlistUrl; // đồng bộ trong thao tác bấm -> iPhone cho phép play()
      el.play().catch(() => {});
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          el.src = playlistUrl;
          el.play().catch(() => {});
          return;
        }
        const hls = new Hls();
        hlsRef.current = hls;
        hls.on(Hls.Events.FRAG_CHANGED, (_e, d) => {
          const sn = typeof d.frag.sn === 'number' ? d.frag.sn : 0;
          hienThiChuong(chiSoTheoDoan(sn));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          const maHttp = data.response?.code;
          if (maHttp === 503) {
            dungNguon();
            setTrangThai({ loai: 'loi', thongBao: 'Hệ thống đang đông, vui lòng thử lại sau ít phút.' });
          } else if (maHttp === 403) {
            dungNguon();
            setTrangThai({ loai: 'vip', soChuong: soChuongBatDau, lyDo: 'can_vip' });
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && soLanThuLaiMangRef.current < 3) {
            soLanThuLaiMangRef.current += 1;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && soLanThuLaiMangRef.current < 3) {
            soLanThuLaiMangRef.current += 1;
            hls.recoverMediaError();
          } else {
            dungNguon();
            setTrangThai({ loai: 'loi', thongBao: 'Không tạo được audio cho đoạn này. Bấm Thử lại.' });
          }
        });
        hls.loadSource(playlistUrl);
        hls.attachMedia(el);
        el.play().catch(() => {});
      });
    }

    // Manifest chỉ để dựng giao diện/mốc chương; tải song song, không chặn việc phát.
    taiManifest(soChuongBatDau).then((man) => {
      if (!man) return;
      manifestRef.current = man;
      setManifest(man);
      chiSoRef.current = 0;
      setChiSoChuong(0);
      setTrangThai({ loai: 'phat' });
      if (laTiepNoi) hienThiChuong(0, true);
      else capNhatMediaSession(man.chuongs[0]);
    });
  }

  // Tự phát khi vừa được điều hướng sang chương theo cờ tuDongPhatNgay (giữ hành vi của modal cũ).
  useEffect(() => {
    if (tuDongPhatNgay && daMount && !daTuDongPhatRef.current) {
      daTuDongPhatRef.current = true;
      batDauPhat(soChuong);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuDongPhatNgay, daMount]);

  function khiKetThuc() {
    setDangPhat(false);
    const man = manifestRef.current;
    if (!man) return;
    if (man.dungLai) {
      setTrangThai({ loai: 'vip', soChuong: man.dungLai.soChuong, lyDo: man.dungLai.lyDo });
      return;
    }
    // Hết 11 chương của playlist: nạp playlist mới từ chương kế (cần trang còn hoạt động).
    if (man.chuongSauCuoi) batDauPhat(man.chuongSauCuoi.soChuong, true);
  }

  function togglePhat() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function doiTocDo(moi: number) {
    setTocDo(moi);
    tocDoRef.current = moi;
    ghiCaiDatAudio({ tocDo: moi });
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = moi;
      audioRef.current.playbackRate = moi;
    }
  }

  const muc = manifest?.chuongs[chiSoChuong] ?? null;
  const thoiGianTrongChuong = muc ? Math.max(0, Math.min(muc.thoiLuongGiay, thoiGian - muc.batDauGiay)) : 0;

  const phanTuAudio = daMount
    ? createPortal(
        <audio
          ref={audioRef}
          preload="auto"
          onPlay={() => setDangPhat(true)}
          onPause={() => setDangPhat(false)}
          onEnded={khiKetThuc}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (!el) return;
            setThoiGian(el.currentTime);
            // Safari (HLS gốc) không có sự kiện đổi đoạn -> suy ra chương từ mốc thời gian ước lượng.
            if (dungHlsGocRef.current) hienThiChuong(chiSoTheoThoiGian(el.currentTime));
          }}
          className="hidden"
        />,
        document.body
      )
    : null;

  if (!moModal || !daMount) return phanTuAudio;

  const dangChay = trangThai.loai === 'phat' || trangThai.loai === 'dangTai';

  return (
    <>
      {phanTuAudio}
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-100 p-5 space-y-5 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-blue-600 truncate">{tenTruyen}</p>
                <h3 className="text-base font-bold text-gray-900 truncate">
                  Chương {muc?.soChuong ?? soChuong}: {muc?.tieuDe ?? tieuDe}
                </h3>
              </div>
              <button
                type="button"
                onClick={onDong}
                aria-label="Đóng"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {trangThai.loai === 'vip' && (
              <div className="py-4 text-center space-y-4">
                <h4 className="font-bold text-gray-900 text-base">Chương {trangThai.soChuong} cần gói VIP</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                  50 chương đầu đọc và nghe miễn phí. Từ chương {trangThai.soChuong} trở đi, vui lòng{' '}
                  {trangThai.lyDo === 'chua_dang_nhap' ? 'đăng nhập và ' : ''}nâng cấp gói VIP để tiếp tục.
                </p>
                <Link
                  href={`/truyen/${slugTruyen}/chuong/${trangThai.soChuong}`}
                  onClick={onDong}
                  className="block w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm shadow-md"
                >
                  💎 Nâng cấp gói VIP để nghe tiếp
                </Link>
              </div>
            )}

            {trangThai.loai === 'loi' && (
              <div className="py-4 text-center space-y-4">
                <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl">{trangThai.thongBao}</p>
                <button
                  type="button"
                  onClick={() => batDauPhat(muc?.soChuong ?? soChuong)}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md"
                >
                  Thử lại
                </button>
              </div>
            )}

            {trangThai.loai === 'nghi' && (
              <div className="py-4 text-center space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Audio giọng đọc Neural (Hoài My)</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Bấm bắt đầu để nghe ngay, tự chuyển sang các chương sau, tắt màn hình vẫn nghe được.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => batDauPhat(soChuong)}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Bắt đầu
                </button>
              </div>
            )}

            {dangChay && (
              <div className="space-y-5 py-2">
                {trangThai.loai === 'dangTai' && !muc && (
                  <p className="text-center text-sm text-blue-600 font-medium">Đang chuẩn bị audio...</p>
                )}
                <div className="space-y-1.5">
                  <input
                    type="range"
                    min={0}
                    max={muc?.thoiLuongGiay ?? 100}
                    step={0.5}
                    value={thoiGianTrongChuong}
                    disabled={!muc}
                    onChange={(e) => {
                      if (muc && audioRef.current) audioRef.current.currentTime = muc.batDauGiay + Number(e.target.value);
                    }}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>{dinhDangThoiGian(thoiGianTrongChuong)}</span>
                    <span>~{dinhDangThoiGian(muc?.thoiLuongGiay ?? 0)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button type="button" onClick={() => tuaGiay(-10)} aria-label="Tua lùi 10 giây" className="text-gray-600 hover:text-blue-600 text-xs font-semibold">
                    « 10s
                  </button>
                  <button
                    type="button"
                    onClick={togglePhat}
                    aria-label={dangPhat ? 'Tạm dừng' : 'Phát'}
                    className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg active:scale-95"
                  >
                    {dangPhat ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                    ) : (
                      <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                  <button type="button" onClick={() => tuaGiay(10)} aria-label="Tua tiến 10 giây" className="text-gray-600 hover:text-blue-600 text-xs font-semibold">
                    10s »
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-gray-600 uppercase">Tốc độ đọc</span>
                    <span className="font-bold text-blue-600 font-mono">{tocDo.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={GIOI_HAN_TOC_DO.min}
                    max={GIOI_HAN_TOC_DO.max}
                    step={0.25}
                    value={tocDo}
                    onChange={(e) => doiTocDo(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {(muc?.soChuongSau ?? soChuongSau) && (
                  <p className="text-[11px] text-gray-400 text-center">
                    Đọc xong sẽ tự động chuyển sang chương sau.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
```

- [ ] **Step 3: Đổi `PanelDocAudio.tsx`**
  - Dòng import: `import ModalNgheAudioThat from './ModalNgheAudioThat';` →
    `import ModalNgheAudioHls from './ModalNgheAudioHls';`
  - Thêm prop `soChuongTruoc?: number;` vào type props và tham số destructure của `PanelDocAudio` (cạnh `soChuongSau`).
  - Thay khối `<ModalNgheAudioThat ... />` (dòng ~301-319) bằng:
```tsx
      <ModalNgheAudioHls
        moModal={moModalThat}
        onDong={() => {
          setMoModalThat(false);
          setTuDongPhatModal(false);
        }}
        chuongId={chuongId}
        slugTruyen={slugTruyen}
        tenTruyen={tenTruyen}
        truyenId={truyenId}
        soChuong={soChuong}
        soChuongTruoc={soChuongTruoc}
        soChuongSau={soChuongSau}
        chuongIdSau={chuongIdSau}
        tieuDe={tieuDe}
        onDungWebSpeech={dungWebSpeech}
        tuDongPhatNgay={tuDongPhatModal}
        onChuyenChuongMoi={onChuyenChuongMoi}
      />
```
  - Prop `audioUrl` của `PanelDocAudio` giữ nguyên trong type (không dùng nữa) để không phải sửa nơi gọi khác.

- [ ] **Step 4: Đổi `KhungDocChuong.tsx`** — trong `<PanelDocAudio ...>` (dòng ~180) thêm
  `soChuongTruoc={chuongHienTai.soChuongTruoc}` cạnh `soChuongSau`.

- [ ] **Step 5: Build + kiểm chứng browser**

Run: `npm run build` (không chạy song song với `next dev` cùng thư mục `.next` — bài học cũ) → sạch.
Run: `npm test` → PASS toàn bộ.
Dùng `preview_start` mở dev server, vào 1 chương free (vd chương 1-2 của 1 truyện), bấm nút loa → "Bắt đầu":
- Console không lỗi; audio phát trong ~1-5 giây; thanh thời gian tiến.
- `read_network_requests`: có `manifest`, `playlist.m3u8` (Content-Type mpegurl) và các `doan?...` trả 200 `audio/mpeg`.
- Kéo tua sang cuối chương (đặt `audio.currentTime` = mốc chương kế) → chữ + URL trang đổi sang chương kế.
- Chương 51+ khi chưa đăng nhập: bấm Bắt đầu → hiện khối "cần gói VIP" (không phát).
- Đóng modal (nút X) → audio vẫn phát tiếp (giữ hành vi cũ).
Chụp ảnh màn hình làm bằng chứng.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json "app/truyen/[slug]/chuong/[so]/ModalNgheAudioHls.tsx" "app/truyen/[slug]/chuong/[so]/PanelDocAudio.tsx" "app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx"
git commit -m "feat(audio-hls): trình phát HLS mới thay modal audio cũ, tự chuyển chương liền mạch"
```

---

### Task 7: Biến môi trường, deploy, kiểm chứng thật, ghi nhật ký

**Files:**
- Modify: `CLAUDE.md` (mục trạng thái), `NEXT_SESSION.md`, `HANDOFF.md`, `PROJECT_MAP.md`
- Create: `docs/handoff/audio-hls-vercel.md`

- [ ] **Step 1: Xin user đồng ý rồi đặt 2 biến môi trường trên Vercel** (project `asuo-team/truyen-chu-dich`,
  Production): `SUPABASE_SERVICE_ROLE_KEY` (giá trị lấy từ `.env.local`) và `AUDIO_TICKET_SECRET` (chuỗi ngẫu nhiên
  mới, KHÁC bản local hoặc dùng cùng, tuỳ user). Cách làm: user tự dán trong Vercel Dashboard → Settings →
  Environment Variables (nhắc: dán KHÔNG kèm dấu ngoặc kép — bài học lỗi Upstash cũ). Khoá service role là
  bí mật nhạy cảm: không in ra log, không commit.

- [ ] **Step 2: Chạy self code-review** bằng skill `code-review` trên toàn bộ diff của Task 1-6 (quy tắc CLAUDE.md).
  Chú ý đặc biệt: (a) không có đường nào trả nội dung/đoạn chương VIP khi thiếu quyền; (b) route đoạn không bao
  giờ tin `c` từ client để quyết định free/VIP ngoài việc so với `SO_CHUONG_FREE`; (c) bộ đếm đồng thời luôn được
  trả trong `finally`; (d) không lộ `SUPABASE_SERVICE_ROLE_KEY` ra client bundle (`npm run build` rồi
  `grep -r "service_role" .next/static` → không có kết quả). Sửa mọi lỗi tìm ra rồi chạy lại test/build.

- [ ] **Step 3: Deploy production** — `npx vercel@latest --prod --yes --scope asuo-team` (bắt buộc `--scope`).

- [ ] **Step 4: Kiểm chứng production bằng curl** (thay `<ID>`, domain `https://truyenchudich.site`):
  manifest/playlist chương 1 → 200; `doan` chương 1 lần 2 → nhanh hơn rõ (CDN `x-vercel-cache: HIT`);
  chương 60 khách chưa đăng nhập → 403 (manifest) và 403 (doan không vé); tham số sai → 400.
  Kiểm tra `curl -sI` của `doan` chương free có `cache-control` public + `s-maxage`, của chương VIP (dùng vé
  hợp lệ từ playlist của tài khoản VIP — nếu không có tài khoản VIP thì bỏ qua) là `private, no-store`.

- [ ] **Step 5: User tự thử trên điện thoại thật** (Android + iPhone nếu có): bấm Nghe audio thật → phát trong
  vài giây; tắt màn hình 2+ phút vẫn nghe; hết chương tự sang chương sau khi tắt màn hình (đây là bằng chứng
  quan trọng nhất); chữ trên màn hình đúng chương khi bật lại (iPhone có thể lệch nhẹ vì mốc chương ước lượng).
  Ghi kết quả thật (không báo "xong" khi chưa có xác nhận này).

- [ ] **Step 6: Theo dõi 1-2 ngày** quota Vercel (Dashboard → Usage: Function Duration/Invocations) và log lỗi 403
  từ Microsoft; ghi số liệu thật vào `docs/handoff/audio-hls-vercel.md`.

- [ ] **Step 7: Ghi nhật ký** — tạo `docs/handoff/audio-hls-vercel.md` (đo đạc, quyết định, bài học: Chrome
  `canPlayType` HLS nói dối, iPhone `play()` phải đồng bộ với thao tác bấm, mốc chương Safari ước lượng);
  thêm 1 dòng vào `HANDOFF.md`; cập nhật `PROJECT_MAP.md` (mục `lib/audio/`, `app/api/audio/`,
  `ModalNgheAudioHls.tsx`); cập nhật `CLAUDE.md` mục "Trạng thái hiện tại" (ngắn) và `NEXT_SESSION.md`
  (việc tiếp: gỡ hệ thống audio cũ khi user xác nhận; hỏi user xoá dự án Vercel tạm `tts-thu-nghiem`).

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md NEXT_SESSION.md HANDOFF.md PROJECT_MAP.md docs/handoff/audio-hls-vercel.md
git commit -m "docs: nhật ký audio HLS trên Vercel và cập nhật bản đồ dự án"
```

---

## Self-review (đối chiếu spec)

- Luồng chính (playlist 11 chương, đoạn tạo theo yêu cầu, CDN cache chương free): Task 3, 5, 6.
- Chia đoạn (100/200/250, xác định, ước lượng thời lượng): Task 1.
- Route đoạn (retry 3 lần, maxDuration 60, cache free/VIP khác nhau): Task 4, 5.
- Quyền VIP (ranh giới playlist, vé HMAC, không tin client): Task 2, 3, 5.
- Chống lạm dụng (rate limit IP, trần đồng thời, fail-open, không dựa middleware): Task 4, 5.
- Lỗi UI (Thử lại, quá tải, VIP/đăng nhập, không spinner vô hạn): Task 6.
- Thay hệ cũ theo giai đoạn (giữ code cũ): Task 6 chỉ đổi import; Task 7 ghi "gỡ sau".
- Kiểm thử (unit + browser + user điện thoại + theo dõi quota): Task 1-7.
- Điểm lệch so với spec: spec ghi ID3 timestamp là tuỳ chọn — plan bỏ ID3 vì cả Android lẫn iPhone đều phát được
  không cần ID3 (đã thử thật); mốc chương trên Safari là ước lượng (hls.js thì chính xác nhờ `FRAG_CHANGED`) — đã
  ghi nhận là rủi ro nhỏ, chỉ ảnh hưởng chữ hiển thị chứ không ảnh hưởng âm thanh.
