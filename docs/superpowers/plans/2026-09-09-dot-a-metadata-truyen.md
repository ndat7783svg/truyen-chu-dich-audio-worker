# Đợt A: Ảnh bìa, tác giả, thể loại, trang chủ/trang truyện nâng cấp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng skill `delegate-antigravity-sk` để giao từng
> Task cho Antigravity qua MCP (`use_antigravity`, mode `plan` rồi `accept-edits`), Claude duyệt và
> tự kiểm tra kết quả thật (chạy lệnh, đọc file, mở browser) sau mỗi Task trước khi sang Task kế
> tiếp — KHÔNG dùng `subagent-driven-development`/`executing-plans` chuẩn của superpowers (dự án
> này ghi đè bằng `CLAUDE.md`). Steps dùng checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Web hiển thị ảnh bìa, tác giả, thể loại (có trang lọc) và mô tả đầy đủ cho từng truyện,
lấy dữ liệu tự động từ `D:\translate truyen` thay vì nhập tay.

**Architecture:** Mở rộng schema Supabase (bảng `the_loai` + bảng nối `truyen_the_loai`, cột
`truyen.tac_gia`) và Storage (bucket `anh-bia`); mở rộng `scripts/sync-truyen.mjs` đọc
`thong-tin/thong-tin.md` + `anh-bia.jpg` thật đã có bên dự án dịch, upload ảnh, upsert metadata +
thể loại mỗi lần "check". Next.js đọc lại dữ liệu này qua các trang đã nâng cấp.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Storage + Auth), Vitest, Tailwind v4.

## Global Constraints

- Định danh biến/hàm cho logic domain dùng tiếng Việt không dấu kiểu camelCase (theo code hiện có:
  `taoSlug`, `parseChuong`, `soChuong`, `tenThuMuc`...).
- Mọi bảng Postgres mới bật RLS; policy đọc công khai (`using (true)`); không tạo policy ghi cho
  client — ghi chỉ qua `SUPABASE_SERVICE_ROLE_KEY` trong `sync-truyen.mjs`.
- Không dùng Supabase CLI/migrations — SQL mới được thêm vào `supabase/schema.sql` (file tích luỹ
  toàn bộ schema) nhưng áp dụng bằng cách dán đúng phần mới vào Supabase Dashboard → SQL Editor
  (thao tác thủ công của user, Claude/Antigravity không có quyền admin DB trực tiếp).
- Chạy mọi script Node độc lập trong `scripts/` bằng `node --env-file=.env.local scripts/<file>`
  (không dùng package `dotenv`).
- Không viết test tự động cho trang/component Next.js — chỉ TDD (Vitest) cho hàm parser thuần
  (giống `parse-chuong.test.js`); phần UI verify bằng cách chạy `npm run dev` và kiểm tra qua trình
  duyệt thật.
- Next.js 16 App Router, Tailwind v4; dự án CHƯA có dark mode (Task 10 của v1 còn dở) — không thêm
  class `dark:` trong Đợt A để tránh không nhất quán với phần code hiện có.
- Ngoài phạm vi (không code trong Đợt A): lượt xem, đánh giá sao, "Top thịnh hành", sidebar "Đọc
  tiếp", thanh toán, audio.

---

### Task 1: DB schema — cột `tac_gia`, bảng `the_loai`/`truyen_the_loai`, Storage bucket `anh-bia`

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: cột `truyen.tac_gia text`; bảng `the_loai(id, ten, slug)`; bảng
  `truyen_the_loai(truyen_id, the_loai_id)` PK kép; bucket Storage công khai `anh-bia`. Task 3 và
  các trang từ Task 4 trở đi phụ thuộc đúng tên bảng/cột này.

- [ ] **Step 1: Thêm SQL mới vào cuối `supabase/schema.sql`**

Nối thêm vào cuối file (giữ nguyên toàn bộ nội dung cũ phía trên):

```sql

-- Đợt A (2026-09-09): ảnh bìa, tác giả, thể loại
alter table truyen add column tac_gia text;

create table the_loai (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  slug text not null unique
);

create table truyen_the_loai (
  truyen_id uuid not null references truyen(id) on delete cascade,
  the_loai_id uuid not null references the_loai(id) on delete cascade,
  primary key (truyen_id, the_loai_id)
);

alter table the_loai enable row level security;
alter table truyen_the_loai enable row level security;

create policy "the_loai doc cong khai" on the_loai for select using (true);
create policy "truyen_the_loai doc cong khai" on truyen_the_loai for select using (true);

insert into storage.buckets (id, name, public)
values ('anh-bia', 'anh-bia', true)
on conflict (id) do nothing;
```

- [ ] **Step 2 (MANUAL — user tự làm): Áp dụng SQL mới**

Vào Supabase Dashboard → project hiện tại → **SQL Editor** → dán **chỉ đoạn SQL mới thêm ở Step 1**
(từ dòng `-- Đợt A (2026-09-09)` trở xuống — KHÔNG chạy lại toàn bộ file vì các bảng cũ
`truyen`/`chuong`/`tien_do_doc` đã tồn tại, chạy lại sẽ báo lỗi "already exists") → Run. Xác nhận:
- **Table Editor** hiện bảng `truyen` có thêm cột `tac_gia`, và 2 bảng mới `the_loai`,
  `truyen_the_loai`.
- **Storage** hiện bucket `anh-bia` (Public).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: them cot tac_gia, bang the_loai/truyen_the_loai, bucket anh-bia"
```

---

### Task 2: Parser `scripts/parse-thong-tin.js` (TDD)

**Files:**
- Create: `scripts/parse-thong-tin.js`
- Test: `scripts/parse-thong-tin.test.js`

**Interfaces:**
- Produces: `parseThongTin(noiDung: string) => { tacGia: string | null, theLoai: string[], moTa: string | null }`
  — export named từ `scripts/parse-thong-tin.js`. Task 3 import và dùng hàm này.

- [ ] **Step 1: Viết file test `scripts/parse-thong-tin.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { parseThongTin } from './parse-thong-tin.js';

const MAU_DAY_DU = `# Tên Truyện Mẫu (示例名称)

**Tác giả gốc:** Tác Giả Mẫu
**Thể loại:** Huyền Huyễn / Tiên Hiệp / Xuyên Không (Bối cảnh giả lập dùng để kiểm thử, không liên quan nội dung thật.)
**Văn phong / xưng hô:**
- Ngôi kể truyện: Ngôi thứ ba.

## Giới thiệu

Đây là đoạn giới thiệu mẫu dùng riêng cho test, không phải nội dung truyện thật.

Dòng thứ hai của đoạn giới thiệu mẫu.
`;

describe('parseThongTin', () => {
  it('tach dung tac gia', () => {
    const kq = parseThongTin(MAU_DAY_DU);
    expect(kq.tacGia).toBe('Tác Giả Mẫu');
  });

  it('tach dung danh sach the loai, bo phan mo ta trong ngoac', () => {
    const kq = parseThongTin(MAU_DAY_DU);
    expect(kq.theLoai).toEqual(['Huyền Huyễn', 'Tiên Hiệp', 'Xuyên Không']);
  });

  it('lay dung noi dung gioi thieu, da trim', () => {
    const kq = parseThongTin(MAU_DAY_DU);
    expect(kq.moTa).toBe(
      'Đây là đoạn giới thiệu mẫu dùng riêng cho test, không phải nội dung truyện thật.\n\nDòng thứ hai của đoạn giới thiệu mẫu.'
    );
  });

  it('the_loai la mang rong neu thieu dong Thể loại', () => {
    const noiDung = '**Tác giả gốc:** X\n\n## Giới thiệu\n\nMô tả.';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual([]);
  });

  it('mo_ta la null neu thieu muc Gioi thieu', () => {
    const noiDung = '**Tác giả gốc:** X\n**Thể loại:** A / B';
    const kq = parseThongTin(noiDung);
    expect(kq.moTa).toBeNull();
  });

  it('tach dung the loai khi khong co ngoac mo ta', () => {
    const noiDung = '**Thể loại:** A / B / C';
    const kq = parseThongTin(noiDung);
    expect(kq.theLoai).toEqual(['A', 'B', 'C']);
  });

  it('tac_gia la null neu thieu dong Tac gia goc', () => {
    const noiDung = '**Thể loại:** A';
    const kq = parseThongTin(noiDung);
    expect(kq.tacGia).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail vì chưa có implementation**

Run: `npx vitest run scripts/parse-thong-tin.test.js`
Expected: FAIL — lỗi kiểu "Failed to resolve import" hoặc "parseThongTin is not a function" vì
`scripts/parse-thong-tin.js` chưa tồn tại.

- [ ] **Step 3: Viết `scripts/parse-thong-tin.js`**

```js
export function parseThongTin(noiDung) {
  return {
    tacGia: timTacGia(noiDung),
    theLoai: timTheLoai(noiDung),
    moTa: timMoTa(noiDung),
  };
}

function timTacGia(noiDung) {
  const khop = noiDung.match(/^\*\*Tác giả gốc:\*\*\s*(.+)$/m);
  return khop ? khop[1].trim() : null;
}

function timTheLoai(noiDung) {
  const khop = noiDung.match(/^\*\*Thể loại:\*\*\s*(.+)$/m);
  if (!khop) return [];
  const phanThoLoai = khop[1].split('(')[0];
  return phanThoLoai
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

function timMoTa(noiDung) {
  const khop = noiDung.match(/^##\s*Giới thiệu\s*$/m);
  if (!khop) return null;
  const phanConLai = noiDung.slice(khop.index + khop[0].length);
  const viTriHeadingKe = phanConLai.search(/^##\s/m);
  const noiDungGioiThieu =
    viTriHeadingKe === -1 ? phanConLai : phanConLai.slice(0, viTriHeadingKe);
  const ketQua = noiDungGioiThieu.trim();
  return ketQua || null;
}
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

Run: `npx vitest run scripts/parse-thong-tin.test.js`
Expected: PASS — 7/7 test.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-thong-tin.js scripts/parse-thong-tin.test.js
git commit -m "feat: parser doc thong-tin.md (tac gia, the loai, gioi thieu)"
```

---

### Task 3: Mở rộng `scripts/sync-truyen.mjs` dùng parser mới

**Files:**
- Modify: `scripts/sync-truyen.mjs`

**Interfaces:**
- Consumes: `parseThongTin` từ Task 2 (`scripts/parse-thong-tin.js`); `taoSlug` (đã có,
  `scripts/slug.js`).
- Produces: dữ liệu thật trong Supabase — `truyen.tac_gia`/`anh_bia`/`mo_ta` được điền tự động,
  bảng `the_loai`/`truyen_the_loai` có dữ liệu — Task 4/5/6 (UI) dựa vào dữ liệu này khi verify qua
  browser.

- [ ] **Step 1: Ghi đè toàn bộ nội dung `scripts/sync-truyen.mjs`**

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { taoSlug } from './slug.js';
import { parseChuong } from './parse-chuong.js';
import { parseThongTin } from './parse-thong-tin.js';

const THU_MUC_GOC =
  process.env.TRANSLATE_TRUYEN_DIR || 'D:\\translate truyen\\danh-sach-truyen';

function docThamSo(argv) {
  const [tenTruyenGoc, ...rest] = argv;
  if (!tenTruyenGoc) {
    console.error(
      'Thieu ten truyen. Cach dung: node sync-truyen.mjs "<Ten truyen>" [--mo-ta "..."] [--anh-bia "URL"]'
    );
    process.exit(1);
  }
  let moTa = null;
  let anhBia = null;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--mo-ta') {
      moTa = rest[i + 1];
      i += 1;
    }
    if (rest[i] === '--anh-bia') {
      anhBia = rest[i + 1];
      i += 1;
    }
  }
  return { tenTruyenGoc, moTa, anhBia };
}

function timThuMucTruyen(tenTruyenGoc) {
  const tatCaThuMuc = readdirSync(THU_MUC_GOC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const timKiem = tenTruyenGoc.toLowerCase();
  const khop = tatCaThuMuc.filter((ten) => ten.toLowerCase().includes(timKiem));

  if (khop.length === 0) {
    console.error(
      `Khong tim thay truyen nao khop "${tenTruyenGoc}". Danh sach hien co:\n- ${tatCaThuMuc.join('\n- ')}`
    );
    process.exit(1);
  }
  if (khop.length > 1) {
    console.error(
      `Khop nhieu hon 1 truyen voi "${tenTruyenGoc}":\n- ${khop.join('\n- ')}\nGo ten chinh xac hon.`
    );
    process.exit(1);
  }
  return khop[0];
}

function docThongTin(tenThuMuc) {
  const thuMucThongTin = join(THU_MUC_GOC, tenThuMuc, 'thong-tin');
  const fileThongTin = join(thuMucThongTin, 'thong-tin.md');
  const fileAnhBia = join(thuMucThongTin, 'anh-bia.jpg');

  const parsed = existsSync(fileThongTin)
    ? parseThongTin(readFileSync(fileThongTin, 'utf-8'))
    : null;
  const duongDanAnhBia = existsSync(fileAnhBia) ? fileAnhBia : null;

  return { parsed, duongDanAnhBia };
}

async function uploadAnhBia(supabase, slug, duongDanFileAnh) {
  const bytes = readFileSync(duongDanFileAnh);
  const { error } = await supabase.storage
    .from('anh-bia')
    .upload(`${slug}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    console.error('Loi upload anh bia:', error.message);
    process.exit(1);
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from('anh-bia').getPublicUrl(`${slug}.jpg`);
  return publicUrl;
}

async function upsertTheLoai(supabase, tenTheLoai) {
  const slugTheLoai = taoSlug(tenTheLoai);
  const { data: hienCo, error: loiTim } = await supabase
    .from('the_loai')
    .select('id')
    .eq('slug', slugTheLoai)
    .maybeSingle();
  if (loiTim) {
    console.error(`Loi truy van the loai "${tenTheLoai}":`, loiTim.message);
    process.exit(1);
  }
  if (hienCo) return hienCo.id;

  const { data: moi, error: loiTao } = await supabase
    .from('the_loai')
    .insert({ ten: tenTheLoai, slug: slugTheLoai })
    .select('id')
    .single();
  if (loiTao) {
    console.error(`Loi tao the loai "${tenTheLoai}":`, loiTao.message);
    process.exit(1);
  }
  return moi.id;
}

async function ganTheLoai(supabase, truyenId, dsTenTheLoai) {
  for (const ten of dsTenTheLoai) {
    const theLoaiId = await upsertTheLoai(supabase, ten);
    const { error } = await supabase
      .from('truyen_the_loai')
      .upsert(
        { truyen_id: truyenId, the_loai_id: theLoaiId },
        { onConflict: 'truyen_id,the_loai_id', ignoreDuplicates: true }
      );
    if (error) {
      console.error(`Loi gan the loai "${ten}":`, error.message);
      process.exit(1);
    }
  }
}

async function main() {
  const { tenTruyenGoc, moTa, anhBia } = docThamSo(process.argv.slice(2));
  const tenThuMuc = timThuMucTruyen(tenTruyenGoc);
  const slug = taoSlug(tenThuMuc);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thieu bien moi truong SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { parsed: thongTin, duongDanAnhBia } = docThongTin(tenThuMuc);

  let anhBiaMoi = null;
  if (duongDanAnhBia) {
    anhBiaMoi = await uploadAnhBia(supabase, slug, duongDanAnhBia);
    console.log(`Da upload anh bia cho "${tenThuMuc}".`);
  } else if (thongTin) {
    console.log(`Canh bao: co thong-tin.md nhung thieu anh-bia.jpg cho "${tenThuMuc}".`);
  }

  const { data: truyenRow, error: loiTimTruyen } = await supabase
    .from('truyen')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (loiTimTruyen) {
    console.error('Loi truy van Supabase (tim truyen):', loiTimTruyen.message);
    process.exit(1);
  }

  let truyenId = truyenRow?.id;

  if (!truyenId) {
    const moTaCuoiCung = thongTin?.moTa ?? moTa;
    if (!moTaCuoiCung) {
      console.error(
        `Truyen "${tenThuMuc}" chua co tren web va khong tim thay thong-tin/thong-tin.md. Chay lai kem --mo-ta "..." de tao moi.`
      );
      process.exit(1);
    }
    const { data: truyenMoi, error: loiTao } = await supabase
      .from('truyen')
      .insert({
        ten: tenThuMuc,
        slug,
        mo_ta: moTaCuoiCung,
        anh_bia: anhBiaMoi ?? anhBia,
        tac_gia: thongTin?.tacGia ?? null,
      })
      .select('id')
      .single();
    if (loiTao) {
      console.error('Loi tao truyen moi:', loiTao.message);
      process.exit(1);
    }
    truyenId = truyenMoi.id;
    console.log(`Da tao truyen moi "${tenThuMuc}" (slug: ${slug}).`);
  } else if (thongTin) {
    const capNhat = {};
    if (thongTin.moTa) capNhat.mo_ta = thongTin.moTa;
    if (thongTin.tacGia) capNhat.tac_gia = thongTin.tacGia;
    if (anhBiaMoi) capNhat.anh_bia = anhBiaMoi;

    if (Object.keys(capNhat).length > 0) {
      const { error: loiCapNhat } = await supabase
        .from('truyen')
        .update(capNhat)
        .eq('id', truyenId);
      if (loiCapNhat) {
        console.error('Loi cap nhat metadata truyen:', loiCapNhat.message);
        process.exit(1);
      }
      console.log(`Da cap nhat metadata (${Object.keys(capNhat).join(', ')}) cho "${tenThuMuc}".`);
    }
  }

  if (thongTin?.theLoai?.length) {
    await ganTheLoai(supabase, truyenId, thongTin.theLoai);
    console.log(`Da gan the loai: ${thongTin.theLoai.join(', ')}.`);
  }

  const { data: chuongDaCo, error: loiDsChuong } = await supabase
    .from('chuong')
    .select('so_chuong')
    .eq('truyen_id', truyenId);

  if (loiDsChuong) {
    console.error('Loi truy van danh sach chuong:', loiDsChuong.message);
    process.exit(1);
  }
  const soDaCo = new Set((chuongDaCo || []).map((c) => c.so_chuong));

  const thuMucChuong = join(THU_MUC_GOC, tenThuMuc, 'chuong');
  if (!existsSync(thuMucChuong)) {
    console.error(`Khong tim thay thu muc chuong: ${thuMucChuong}`);
    process.exit(1);
  }
  const fileChuong = readdirSync(thuMucChuong).filter((f) => /^chuong-\d{3}\.md$/.test(f));

  const daDang = [];
  const boQua = [];
  for (const tenFile of fileChuong) {
    let thongTinChuong;
    try {
      const noiDungFile = readFileSync(join(thuMucChuong, tenFile), 'utf-8');
      thongTinChuong = parseChuong(tenFile, noiDungFile);
    } catch (err) {
      console.error(`Bo qua file loi dinh dang "${tenFile}": ${err.message}`);
      boQua.push(tenFile);
      continue;
    }
    if (soDaCo.has(thongTinChuong.soChuong)) continue;

    const { error: loiDang } = await supabase.from('chuong').insert({
      truyen_id: truyenId,
      so_chuong: thongTinChuong.soChuong,
      tieu_de: thongTinChuong.tieuDe,
      noi_dung: thongTinChuong.noiDung,
    });
    if (loiDang) {
      console.error(`Loi dang chuong ${thongTinChuong.soChuong}:`, loiDang.message);
      boQua.push(tenFile);
      continue;
    }
    daDang.push(thongTinChuong.soChuong);
  }

  daDang.sort((a, b) => a - b);
  if (daDang.length === 0) {
    console.log(`Khong co chuong moi cho truyen "${tenThuMuc}".`);
  } else {
    console.log(`Da dang ${daDang.length} chuong moi cho "${tenThuMuc}": ${daDang.join(', ')}`);
  }
  if (boQua.length > 0) {
    console.log(`Bo qua ${boQua.length} file loi: ${boQua.join(', ')}`);
  }
}

main();
```

- [ ] **Step 2: Chạy bộ test hiện có, xác nhận không regression**

Run: `npx vitest run`
Expected: PASS toàn bộ (bao gồm `slug.test.js`, `parse-chuong.test.js`, `parse-thong-tin.test.js` —
`sync-truyen.mjs` không có unit test riêng, giống quy ước hiện tại của file này).

- [ ] **Step 3: Chạy thật lần 1 — verify đọc đúng dữ liệu thật đã có**

Run: `node --env-file=.env.local scripts/sync-truyen.mjs "Tà Tu Hảo A"`
Expected: stdout có đủ các dòng (thứ tự có thể khác):
- `Da upload anh bia cho "Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái".`
- `Da cap nhat metadata (mo_ta, tac_gia, anh_bia) cho "Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái".`
- `Da gan the loai: Huyền Huyễn, Tà tu, Xuyên không.`
- Dòng báo chương mới/không có chương mới (tuỳ dữ liệu hiện tại).
- KHÔNG có dòng nào bắt đầu bằng `Loi` (lỗi).

- [ ] **Step 4: Chạy lại lần 2 ngay sau đó — verify idempotent**

Run: `node --env-file=.env.local scripts/sync-truyen.mjs "Tà Tu Hảo A"`
Expected: chạy xong không lỗi (không có dòng `Loi`/exit code khác 0), không có exception do
`the_loai`/`truyen_the_loai` bị trùng khoá.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-truyen.mjs
git commit -m "feat: sync-truyen doc thong-tin.md, upload anh bia, gan the loai"
```

---

### Task 4: Trang chủ nâng cấp — thẻ truyện, ảnh bìa, nav Thể loại

**Files:**
- Modify: `next.config.ts`
- Create: `components/TheTruyen.tsx`
- Create: `components/DropdownTheLoai.tsx`
- Modify: `components/Header.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `export type TruyenThe = { slug: string; ten: string; tacGia: string | null; anhBia: string | null; trangThai: string; theLoai: { ten: string; slug: string }[] }`
  và `export default function TheTruyen({ truyen }: { truyen: TruyenThe })` từ
  `components/TheTruyen.tsx` — Task 5 và Task 6 dùng lại type/component này.
- Consumes: bảng `the_loai`, `truyen_the_loai`, cột `truyen.tac_gia`/`anh_bia` (Task 1 + Task 3).

- [ ] **Step 1: Ghi đè `next.config.ts` — cho phép `next/image` tải ảnh từ Supabase Storage**

```ts
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Tạo `components/TheTruyen.tsx`**

```tsx
import Link from 'next/link';
import Image from 'next/image';

export type TruyenThe = {
  slug: string;
  ten: string;
  tacGia: string | null;
  anhBia: string | null;
  trangThai: string;
  theLoai: { ten: string; slug: string }[];
};

export default function TheTruyen({ truyen }: { truyen: TruyenThe }) {
  const theLoaiHienThi = truyen.theLoai.slice(0, 3);
  const soDu = truyen.theLoai.length - theLoaiHienThi.length;

  return (
    <Link
      href={`/truyen/${truyen.slug}`}
      className="block rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[2/3] bg-gray-200">
        {truyen.anhBia ? (
          <Image
            src={truyen.anhBia}
            alt={truyen.ten}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm px-2 text-center">
            Chưa có ảnh bìa
          </div>
        )}
        <span className="absolute top-1 left-1 px-2 py-0.5 rounded text-xs bg-black/60 text-white">
          {truyen.trangThai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
        </span>
      </div>
      <div className="p-2">
        <h3 className="font-medium line-clamp-2">{truyen.ten}</h3>
        {truyen.tacGia && <p className="text-sm text-gray-500 truncate">{truyen.tacGia}</p>}
        {theLoaiHienThi.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {theLoaiHienThi.map((tl) => (
              <span
                key={tl.slug}
                className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
              >
                {tl.ten}
              </span>
            ))}
            {soDu > 0 && <span className="text-xs px-1.5 py-0.5 text-gray-500">+{soDu}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Tạo `components/DropdownTheLoai.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DropdownTheLoai({
  dsTheLoai,
}: {
  dsTheLoai: { ten: string; slug: string }[];
}) {
  const [moRong, setMoRong] = useState(false);

  if (dsTheLoai.length === 0) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setMoRong((v) => !v)} className="hover:underline">
        Thể loại
      </button>
      {moRong && (
        <ul className="absolute left-0 mt-1 w-48 rounded border bg-white shadow-md z-10 max-h-64 overflow-y-auto">
          {dsTheLoai.map((tl) => (
            <li key={tl.slug}>
              <Link
                href={`/the-loai/${tl.slug}`}
                className="block px-3 py-2 hover:bg-gray-100"
                onClick={() => setMoRong(false)}
              >
                {tl.ten}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Sửa `components/Header.tsx` — thêm dropdown Thể loại**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import NutDangXuat from './NutDangXuat';
import DropdownTheLoai from './DropdownTheLoai';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="max-w-3xl mx-auto p-4 flex justify-between items-center">
      <Link href="/" className="font-bold">
        Truyện dịch AI
      </Link>
      <nav className="flex items-center gap-4">
        <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
        <div className="flex items-center gap-3">
          {user ? (
            <NutDangXuat />
          ) : (
            <>
              <Link href="/dang-nhap" className="hover:underline">
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="hover:underline">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 5: Ghi đè `app/page.tsx` — dùng `TheTruyen`, query kèm thể loại**

```tsx
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import SearchBox from '@/components/SearchBox';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';

type HangTruyen = {
  ten: string;
  slug: string;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await taoSupabaseServerClient();

  let query = supabase
    .from('truyen')
    .select('ten, slug, anh_bia, trang_thai, tac_gia, truyen_the_loai(the_loai(ten, slug))')
    .order('created_at', { ascending: false });
  if (q) {
    query = query.ilike('ten', `%${q}%`);
  }
  const { data } = await query;
  const dsTruyen = (data ?? []) as HangTruyen[];

  const dsThe: TruyenThe[] = dsTruyen.map((t) => ({
    slug: t.slug,
    ten: t.ten,
    tacGia: t.tac_gia,
    anhBia: t.anh_bia,
    trangThai: t.trang_thai,
    theLoai: t.truyen_the_loai.map((n) => n.the_loai),
  }));

  return (
    <main className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Truyện dịch AI</h1>
      <SearchBox defaultValue={q ?? ''} />
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dsThe.map((truyen) => (
          <TheTruyen key={truyen.slug} truyen={truyen} />
        ))}
      </div>
      {dsThe.length === 0 && <p className="mt-4 text-gray-500">Không tìm thấy truyện nào.</p>}
    </main>
  );
}
```

- [ ] **Step 6: Test qua browser**

Run: `npm run dev`, mở `http://localhost:3000`. Kiểm tra:
- Trang chủ hiện thẻ truyện có ảnh bìa thật (không vỡ ảnh), tên tác giả, badge trạng thái, badge
  thể loại đúng 3 thể loại đã gán ở Task 3.
- Nav "Thể loại" mở dropdown liệt kê đúng 3 thể loại, bấm 1 mục điều hướng tới
  `/the-loai/[slug]` (trang này sẽ 404/lỗi cho tới khi làm Task 5 — chấp nhận được ở bước này).
- Ô tìm kiếm vẫn hoạt động như cũ.
- Không có lỗi trong console trình duyệt liên quan tới `next/image` (domain chưa được phép...).

- [ ] **Step 7: Commit**

```bash
git add next.config.ts components/TheTruyen.tsx components/DropdownTheLoai.tsx components/Header.tsx app/page.tsx
git commit -m "feat: trang chu nang cap - the truyen, anh bia, dropdown the loai"
```

---

### Task 5: Trang `/the-loai/[slug]`

**Files:**
- Create: `app/the-loai/[slug]/page.tsx`

**Interfaces:**
- Consumes: `TheTruyen`, `TruyenThe` từ `components/TheTruyen.tsx` (Task 4).

- [ ] **Step 1: Tạo `app/the-loai/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';

type HangLienKet = {
  truyen: {
    slug: string;
    ten: string;
    anh_bia: string | null;
    trang_thai: string;
    tac_gia: string | null;
  };
};

export default async function TrangTheLoai({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data: theLoai } = await supabase
    .from('the_loai')
    .select('id, ten, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!theLoai) notFound();

  const { data } = await supabase
    .from('truyen_the_loai')
    .select('truyen(slug, ten, anh_bia, trang_thai, tac_gia)')
    .eq('the_loai_id', theLoai.id);

  const dsLienKet = (data ?? []) as HangLienKet[];
  const dsThe: TruyenThe[] = dsLienKet.map((lk) => ({
    slug: lk.truyen.slug,
    ten: lk.truyen.ten,
    tacGia: lk.truyen.tac_gia,
    anhBia: lk.truyen.anh_bia,
    trangThai: lk.truyen.trang_thai,
    theLoai: [],
  }));

  return (
    <main className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Thể loại: {theLoai.ten}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dsThe.map((truyen) => (
          <TheTruyen key={truyen.slug} truyen={truyen} />
        ))}
      </div>
      {dsThe.length === 0 && (
        <p className="text-gray-500">Chưa có truyện nào thuộc thể loại này.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Test qua browser**

Với dev server đang chạy (`npm run dev`), mở `http://localhost:3000/the-loai/huyen-huyen` (hoặc
slug đúng của 1 trong 3 thể loại đã gán ở Task 3 — kiểm tra bảng `the_loai` nếu không chắc slug
chính xác). Kiểm tra:
- Tiêu đề hiện đúng tên thể loại.
- Truyện "Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái" xuất hiện trong lưới.
- Mở `http://localhost:3000/the-loai/khong-ton-tai` → không lỗi 500, hiện trang not-found bình
  thường.
- Bấm badge thể loại từ dropdown nav (Task 4) dẫn đúng tới trang này.

- [ ] **Step 3: Commit**

```bash
git add app/the-loai
git commit -m "feat: trang /the-loai/[slug] - loc truyen theo the loai"
```

---

### Task 6: Trang truyện nâng cấp — ảnh bìa, tác giả, badge thể loại, mô tả đầy đủ

**Files:**
- Modify: `app/truyen/[slug]/page.tsx`

**Interfaces:**
- Consumes: bảng `truyen_the_loai`/`the_loai`, cột `truyen.tac_gia`/`anh_bia` (Task 1 + Task 3).

- [ ] **Step 1: Ghi đè `app/truyen/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

type HangTruyen = {
  id: string;
  ten: string;
  mo_ta: string | null;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

export default async function TrangTruyen({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data } = await supabase
    .from('truyen')
    .select(
      'id, ten, mo_ta, anh_bia, trang_thai, tac_gia, truyen_the_loai(the_loai(ten, slug))'
    )
    .eq('slug', slug)
    .maybeSingle();
  const truyen = data as HangTruyen | null;

  if (!truyen) notFound();

  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('id, so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let chuongDangDoc: { so_chuong: number } | null = null;
  if (user) {
    const { data: tienDo } = await supabase
      .from('tien_do_doc')
      .select('chuong:chuong_id(so_chuong)')
      .eq('user_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    chuongDangDoc = (tienDo?.chuong as { so_chuong: number } | null) ?? null;
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <div className="flex gap-4">
        <div className="relative w-32 aspect-[2/3] shrink-0 bg-gray-200 rounded overflow-hidden">
          {truyen.anh_bia ? (
            <Image
              src={truyen.anh_bia}
              alt={truyen.ten}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400 text-xs text-center px-1">
              Chưa có ảnh bìa
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{truyen.ten}</h1>
          {truyen.tac_gia && <p className="text-gray-600">Tác giả: {truyen.tac_gia}</p>}
          <p className="text-sm text-gray-500">
            {truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
          </p>
          {truyen.truyen_the_loai.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {truyen.truyen_the_loai.map((n) => (
                <Link
                  key={n.the_loai.slug}
                  href={`/the-loai/${n.the_loai.slug}`}
                  className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {n.the_loai.ten}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {truyen.mo_ta && <p className="mt-4 text-gray-600 whitespace-pre-line">{truyen.mo_ta}</p>}
      {chuongDangDoc && (
        <Link
          href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
          className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 text-white"
        >
          Đọc tiếp Chương {chuongDangDoc.so_chuong}
        </Link>
      )}
      <ul className="mt-6 space-y-1">
        {(dsChuong ?? []).map((chuong) => (
          <li key={chuong.id}>
            <Link href={`/truyen/${slug}/chuong/${chuong.so_chuong}`} className="hover:underline">
              Chương {chuong.so_chuong}: {chuong.tieu_de}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Test qua browser**

Mở `http://localhost:3000/truyen/ta-tu-hao-a-ta-tu-thang-cap-khoai` (slug thật — kiểm tra đúng slug
trong bảng `truyen` nếu khác). Kiểm tra:
- Ảnh bìa lớn hiện đúng, không vỡ.
- Dòng "Tác giả: ..." hiện đúng giá trị đã sync.
- 3 badge thể loại hiện đúng, bấm 1 badge dẫn tới đúng trang `/the-loai/[slug]` tương ứng (Task 5).
- Mô tả đầy đủ (không bị cắt ngắn) hiện đúng nội dung mục "Giới thiệu" trong `thong-tin.md`.
- Danh sách chương + nút "Đọc tiếp" (nếu đã đăng nhập và có tiến độ đọc) vẫn hoạt động như trước.

- [ ] **Step 3: Commit**

```bash
git add app/truyen
git commit -m "feat: trang truyen nang cap - anh bia, tac gia, badge the loai, mo ta day du"
```

---

### Task 7: Kiểm tra tổng thể + cập nhật tài liệu trạng thái

**Files:**
- Modify: `CLAUDE.md`
- Modify: `NEXT_SESSION.md`
- Modify: `HANDOFF.md` (nếu phát sinh kinh nghiệm kỹ thuật mới cần ghi lại)

- [ ] **Step 1: Kiểm tra luồng end-to-end qua browser thật**

Với `npm run dev` đang chạy: trang chủ → bấm thẻ truyện → trang truyện (ảnh/tác giả/thể loại/mô tả
đúng) → bấm 1 badge thể loại → trang `/the-loai/[slug]` (thấy đúng truyện) → bấm lại thẻ truyện →
bấm 1 chương → trang đọc chương vẫn hoạt động bình thường (không bị ảnh hưởng bởi thay đổi Đợt A).
Xác nhận không có lỗi console/network nào liên quan `next/image` hay query Supabase.

- [ ] **Step 2: Cập nhật `CLAUDE.md` mục "Trạng thái hiện tại"**

Ghi rõ: Đợt A (ảnh bìa/tác giả/thể loại/trang chủ+trang truyện nâng cấp) đã xong + kiểm chứng thật.
Đợt B (lượt xem, đánh giá sao, top thịnh hành, đọc tiếp sidebar) chưa làm, xem spec
`docs/superpowers/specs/2026-09-09-dot-a-metadata-truyen-design.md` mục "Ngoài phạm vi" để biết
phạm vi đợt sau. Task 10 (dark mode) và Task 11 (deploy) của plan v1 vẫn còn dở.

- [ ] **Step 3: Cập nhật `NEXT_SESSION.md`**

Xoá phần "Đang làm dở" cũ liên quan Đợt A, ghi bước tiếp theo thật (vd: quay lại Task 10 dark mode
của v1, hoặc bàn thiết kế Đợt B nếu user muốn làm tiếp).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md NEXT_SESSION.md HANDOFF.md docs/handoff
git commit -m "docs: cap nhat trang thai sau khi hoan thanh Dot A"
```
