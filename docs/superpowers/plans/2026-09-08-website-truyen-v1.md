# Website Đọc Truyện Dịch AI — v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Ghi đè theo quy tắc riêng của dự án này (`CLAUDE.md`):** mọi bước code (không phải bước
> manual/setup) phải được giao cho Antigravity qua MCP theo skill `delegate-antigravity-sk` —
> Claude/subagent đóng vai quản lý: gửi `prompt` = nội dung task này, `mode: "plan"` trước, tự
> duyệt, rồi `mode: "accept-edits"`, sau đó tự chạy các lệnh kiểm tra ở bước "Verify" của từng
> task để xác nhận thật (không chỉ tin báo cáo của Antigravity), lặp sửa tối đa 4 lần theo đúng
> quy trình trong skill đó.

**Goal:** Dựng xong website đọc truyện chữ (Next.js + Supabase) với đầy đủ tính năng v1: danh sách
truyện, tìm kiếm, trang đọc chương, đăng ký/đăng nhập, lưu tiến độ đọc, dark mode — cộng với script
đồng bộ dữ liệu từ `D:\translate truyen` (cơ chế "check [tên truyện]").

**Architecture:** Next.js 15 (App Router, TypeScript) deploy trên Vercel. Supabase lo Postgres +
Auth. Trang web chỉ ĐỌC dữ liệu từ Supabase (không tự dịch/tạo nội dung). Một script Node độc lập
(`scripts/sync-truyen.mjs`) đọc file `.md` từ `D:\translate truyen`, ghi chương mới vào Supabase
bằng service-role key (bypass RLS) — đây là cơ chế thực thi phía sau lệnh "check [tên truyện]".

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, `@supabase/supabase-js`,
`@supabase/ssr`, Vitest (unit test cho logic thuần), Vercel (hosting).

## Global Constraints
- Chỉ đọc dữ liệu từ `D:\translate truyen`, KHÔNG BAO GIỜ ghi/sửa file trong thư mục đó.
- KHÔNG code phần trả phí mua chương và KHÔNG code phần audio trong trang đọc — ngoài phạm vi v1
  (spec: `docs/superpowers/specs/2026-09-08-website-truyen-design.md`).
- `chuong` bảng có ràng buộc `unique(truyen_id, so_chuong)` — không được insert chương trùng.
- Dark mode phải theo đúng cơ chế: script inline set `data-theme` trước hydrate, VÀ client
  component tự đọc `localStorage` rồi chủ động set lại `data-theme` trong `useEffect` (không chỉ
  tin DOM còn giữ nguyên attribute sau hydrate).
- Test cho logic thuần (slug, parse chương) bắt buộc viết unit test trước (TDD). Test cho các
  trang UI: xác minh thủ công qua trình duyệt (preview_start / dev server) — spec đã chốt không
  cần bộ test tự động phức tạp cho v1.
- Không tự tạo tài khoản Supabase/Vercel hay nhập thông tin đăng nhập thay user — các bước đó do
  user tự làm (đánh dấu rõ "MANUAL — user tự làm" trong plan).

---

## Prerequisites (MANUAL — user tự làm trước Task 1)

1. Cài Node.js bản 18 trở lên nếu máy chưa có (kiểm tra: `node --version`).
2. Vào https://supabase.com, tạo tài khoản/đăng nhập, tạo 1 project mới miễn phí (free tier).
3. Trong project đó, vào **Settings → API**, ghi lại 3 giá trị:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ giữ bí mật tuyệt đối, không commit, không đưa vào code chạy trên
     trình duyệt — chỉ dùng trong `scripts/sync-truyen.mjs` chạy ở máy local)
4. Gửi 3 giá trị trên cho Claude/Antigravity để điền vào `.env.local` (Task 1).

---

### Task 1: Scaffold Next.js app + kết nối Supabase + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts` (hoặc cấu hình
  Tailwind v4 tương đương do `create-next-app` sinh ra), `app/layout.tsx`, `app/globals.css`,
  `app/page.tsx` (placeholder), `.env.local.example`, `.env.local` (điền giá trị thật, không
  commit), `.gitignore`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `vitest.config.ts`,
  `__smoke__/smoke.test.ts`

**Interfaces:**
- Produces: `taoSupabaseClient(): SupabaseClient` (từ `lib/supabase/client.ts`, dùng trong Client
  Component) và `taoSupabaseServerClient(): Promise<SupabaseClient>` (từ `lib/supabase/server.ts`,
  dùng trong Server Component/Server Action) — mọi task sau dùng lại 2 hàm này để truy vấn DB.

- [ ] **Step 1: Khởi tạo Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*"
```

- [ ] **Step 2: Cài Supabase SDK + Vitest**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest
```

- [ ] **Step 3: Thêm script test vào `package.json`**

Mở `package.json`, thêm vào `"scripts"`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Tạo `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Tạo file `.env.local.example` và `.env.local`**

`.env.local.example` (commit file này, chỉ chứa tên biến):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TRANSLATE_TRUYEN_DIR=D:\translate truyen\danh-sach-truyen
```

`.env.local` (KHÔNG commit — điền giá trị thật lấy từ Prerequisites bước 3; `SUPABASE_URL` giống
hệt `NEXT_PUBLIC_SUPABASE_URL`, chỉ tách biến vì script Node ở `scripts/` không đọc được biến có
tiền tố `NEXT_PUBLIC_` theo quy ước Next.js):
```
NEXT_PUBLIC_SUPABASE_URL=<project-url-that>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-that>
SUPABASE_URL=<project-url-that>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-that>
TRANSLATE_TRUYEN_DIR=D:\translate truyen\danh-sach-truyen
```

- [ ] **Step 6: Kiểm tra `.gitignore` có đủ dòng sau (thường `create-next-app` đã tự thêm phần
      lớn, chỉ bổ sung nếu thiếu)**

```
node_modules
.next
.env.local
```

- [ ] **Step 7: Tạo `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function taoSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 8: Tạo `lib/supabase/server.ts`**

```ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function taoSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component không set được cookie trực tiếp — middleware (Task 9) lo refresh session.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 9: Tạo file test smoke `__smoke__/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest da chay duoc', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 10: Chạy test, xác nhận pass**

```bash
npm test
```
Expected: 1 test passed (`smoke.test.ts`).

- [ ] **Step 11: Chạy dev server, xác nhận trang chạy được**

```bash
npm run dev
```
Mở trình duyệt tại `http://localhost:3000` (dùng `preview_start` với url đó) — thấy trang mặc định
của `create-next-app` hiện ra không lỗi console.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, ket noi Supabase, setup Vitest"
```

---

### Task 2: DB schema Supabase

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: 3 bảng `truyen`, `chuong`, `tien_do_doc` với RLS — mọi task từ Task 3 trở đi phụ thuộc
  đúng tên cột trong bảng này.

- [ ] **Step 1: Viết `supabase/schema.sql`**

```sql
create extension if not exists pgcrypto;

create table truyen (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  slug text not null unique,
  mo_ta text,
  anh_bia text,
  trang_thai text not null default 'dang-ra' check (trang_thai in ('dang-ra', 'hoan-thanh')),
  created_at timestamptz not null default now()
);

create table chuong (
  id uuid primary key default gen_random_uuid(),
  truyen_id uuid not null references truyen(id) on delete cascade,
  so_chuong int not null,
  tieu_de text not null,
  noi_dung text not null,
  created_at timestamptz not null default now(),
  unique (truyen_id, so_chuong)
);

create table tien_do_doc (
  user_id uuid not null references auth.users(id) on delete cascade,
  truyen_id uuid not null references truyen(id) on delete cascade,
  chuong_id uuid not null references chuong(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, truyen_id)
);

alter table truyen enable row level security;
alter table chuong enable row level security;
alter table tien_do_doc enable row level security;

create policy "truyen doc cong khai" on truyen for select using (true);
create policy "chuong doc cong khai" on chuong for select using (true);

create policy "user xem tien do cua minh" on tien_do_doc
  for select using (auth.uid() = user_id);
create policy "user tao tien do cua minh" on tien_do_doc
  for insert with check (auth.uid() = user_id);
create policy "user sua tien do cua minh" on tien_do_doc
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Ghi chú: không có policy insert/update cho `truyen`/`chuong` ở phía `anon`/`authenticated` — chỉ
`service_role` (dùng trong `scripts/sync-truyen.mjs`) mới ghi được, vì service_role bỏ qua RLS mặc
định.

- [ ] **Step 2 (MANUAL — user tự làm): Áp dụng schema**

Vào Supabase Dashboard → project vừa tạo → **SQL Editor** → dán toàn bộ nội dung
`supabase/schema.sql` → Run. Xác nhận không có lỗi, và mục **Table Editor** hiện đủ 3 bảng
`truyen`, `chuong`, `tien_do_doc`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: them DB schema Supabase (truyen, chuong, tien_do_doc)"
```

---

### Task 3: `scripts/slug.js` — sinh slug từ tên truyện

**Files:**
- Create: `scripts/slug.js`
- Test: `scripts/slug.test.js`

**Interfaces:**
- Produces: `taoSlug(ten: string): string` — Task 5 (`sync-truyen.mjs`) dùng hàm này để tính slug
  khớp với cột `truyen.slug`.

- [ ] **Step 1: Viết test trước (`scripts/slug.test.js`)**

```js
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL (chưa có file slug.js)**

```bash
npx vitest run scripts/slug.test.js
```
Expected: FAIL — không tìm thấy module `./slug.js`.

- [ ] **Step 3: Viết `scripts/slug.js`**

```js
export function taoSlug(ten) {
  return ten
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

```bash
npx vitest run scripts/slug.test.js
```
Expected: 3 test passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/slug.js scripts/slug.test.js
git commit -m "feat: them ham taoSlug (sinh slug tu ten truyen tieng Viet)"
```

---

### Task 4: `scripts/parse-chuong.js` — parse file `.md` 1 chương

**Files:**
- Create: `scripts/parse-chuong.js`
- Test: `scripts/parse-chuong.test.js`

**Interfaces:**
- Produces: `parseChuong(tenFile: string, noiDungFile: string): { soChuong: number, tieuDe:
  string, noiDung: string }` — Task 5 dùng hàm này để đọc từng file `chuong-XXX.md`. Ném lỗi
  (`throw new Error(...)`) nếu file sai định dạng — Task 5 phải `try/catch` quanh lời gọi này.

- [ ] **Step 1: Viết test trước (`scripts/parse-chuong.test.js`)**

```js
import { describe, it, expect } from 'vitest';
import { parseChuong } from './parse-chuong.js';

const MAU_HOP_LE = `# Chương 1: Thế đạo thối nát tận xương

Tào Bút ngồi thu lu ở góc tường, ngước nhìn vầng trăng trên trời.

Xuyên không đã ba năm rồi.
`;

describe('parseChuong', () => {
  it('tach dung so chuong tu ten file', () => {
    const kq = parseChuong('chuong-001.md', MAU_HOP_LE);
    expect(kq.soChuong).toBe(1);
  });

  it('tach dung tieu de tu dong dau (bo phan "Chuong N:")', () => {
    const kq = parseChuong('chuong-001.md', MAU_HOP_LE);
    expect(kq.tieuDe).toBe('Thế đạo thối nát tận xương');
  });

  it('lay dung noi dung con lai, da trim', () => {
    const kq = parseChuong('chuong-001.md', MAU_HOP_LE);
    expect(kq.noiDung).toBe(
      'Tào Bút ngồi thu lu ở góc tường, ngước nhìn vầng trăng trên trời.\n\nXuyên không đã ba năm rồi.'
    );
  });

  it('nem loi neu ten file sai dinh dang', () => {
    expect(() => parseChuong('chuong-1.md', MAU_HOP_LE)).toThrow();
  });

  it('nem loi neu file thieu dong tieu de bat dau bang #', () => {
    expect(() => parseChuong('chuong-002.md', 'Khong co tieu de\n\nNoi dung')).toThrow();
  });

  it('nem loi neu file khong co noi dung sau dong tieu de', () => {
    expect(() => parseChuong('chuong-003.md', '# Chương 3: Trống\n\n')).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx vitest run scripts/parse-chuong.test.js
```
Expected: FAIL — không tìm thấy module `./parse-chuong.js`.

- [ ] **Step 3: Viết `scripts/parse-chuong.js`**

```js
export function parseChuong(tenFile, noiDungFile) {
  const khopSo = tenFile.match(/^chuong-(\d+)\.md$/);
  if (!khopSo) {
    throw new Error(`Ten file khong dung dinh dang chuong-XXX.md: ${tenFile}`);
  }
  const soChuong = parseInt(khopSo[1], 10);

  const dong = noiDungFile.split('\n');
  const dongDauTien = (dong[0] || '').trim();
  if (!dongDauTien.startsWith('#')) {
    throw new Error(`File ${tenFile} thieu dong tieu de bat dau bang "#"`);
  }

  const khopTieuDe = dongDauTien.match(/^#\s*Ch[uư][oơ]ng\s+\d+\s*:\s*(.+)$/i);
  const tieuDe = khopTieuDe ? khopTieuDe[1].trim() : dongDauTien.replace(/^#\s*/, '').trim();

  const noiDung = dong.slice(1).join('\n').trim();
  if (!noiDung) {
    throw new Error(`File ${tenFile} khong co noi dung sau dong tieu de`);
  }

  return { soChuong, tieuDe, noiDung };
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

```bash
npx vitest run scripts/parse-chuong.test.js
```
Expected: 6 test passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-chuong.js scripts/parse-chuong.test.js
git commit -m "feat: them ham parseChuong (doc file .md 1 chuong)"
```

---

### Task 5: `scripts/sync-truyen.mjs` — cơ chế "check [tên truyện]"

**Files:**
- Create: `scripts/sync-truyen.mjs`

**Interfaces:**
- Consumes: `taoSlug` (Task 3), `parseChuong` (Task 4), bảng `truyen`/`chuong` (Task 2).
- Produces: script CLI chạy bằng `node scripts/sync-truyen.mjs "<Ten truyen>" [--mo-ta "..."]
  [--anh-bia "URL"]` — đây chính là hành động Claude thực hiện khi user gõ "check [tên truyện]"
  trong chat (Claude chạy lệnh này qua Bash tool với tên truyện tương ứng).

- [ ] **Step 1: Viết `scripts/sync-truyen.mjs`**

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { taoSlug } from './slug.js';
import { parseChuong } from './parse-chuong.js';

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
    if (!moTa) {
      console.error(
        `Truyen "${tenThuMuc}" chua co tren web. Chay lai kem --mo-ta "..." (va --anh-bia "URL" neu co) de tao moi.`
      );
      process.exit(1);
    }
    const { data: truyenMoi, error: loiTao } = await supabase
      .from('truyen')
      .insert({ ten: tenThuMuc, slug, mo_ta: moTa, anh_bia: anhBia })
      .select('id')
      .single();
    if (loiTao) {
      console.error('Loi tao truyen moi:', loiTao.message);
      process.exit(1);
    }
    truyenId = truyenMoi.id;
    console.log(`Da tao truyen moi "${tenThuMuc}" (slug: ${slug}).`);
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
  const fileChuong = readdirSync(thuMucChuong).filter((f) => /^chuong-\d+\.md$/.test(f));

  const daDang = [];
  const boQua = [];
  for (const tenFile of fileChuong) {
    let thongTin;
    try {
      const noiDungFile = readFileSync(join(thuMucChuong, tenFile), 'utf-8');
      thongTin = parseChuong(tenFile, noiDungFile);
    } catch (err) {
      console.error(`Bo qua file loi dinh dang "${tenFile}": ${err.message}`);
      boQua.push(tenFile);
      continue;
    }
    if (soDaCo.has(thongTin.soChuong)) continue;

    const { error: loiDang } = await supabase.from('chuong').insert({
      truyen_id: truyenId,
      so_chuong: thongTin.soChuong,
      tieu_de: thongTin.tieuDe,
      noi_dung: thongTin.noiDung,
    });
    if (loiDang) {
      console.error(`Loi dang chuong ${thongTin.soChuong}:`, loiDang.message);
      boQua.push(tenFile);
      continue;
    }
    daDang.push(thongTin.soChuong);
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

- [ ] **Step 2 (Verify — dùng luôn dữ liệu thật để bootstrap): chạy lần đầu cho truyện đã có sẵn**

```bash
node scripts/sync-truyen.mjs "Tà Tu Hảo A" --mo-ta "Xuyên không thời loạn thế, dịch AI Trung sang Việt."
```
Expected: in ra `Da tao truyen moi "Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái" (slug: ...)` rồi
`Da dang 141 chuong moi cho "...": 1, 11, 12, ..., 150`. Vào Supabase Table Editor kiểm tra bảng
`truyen` có 1 dòng, bảng `chuong` có 141 dòng.

- [ ] **Step 3: Verify chạy lại lần 2 không tạo trùng**

```bash
node scripts/sync-truyen.mjs "Tà Tu Hảo A"
```
Expected: `Khong co chuong moi cho truyen "...".` — không có dòng mới nào được thêm vào `chuong`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-truyen.mjs
git commit -m "feat: them script sync-truyen.mjs (co che check [ten truyen])"
```

---

### Task 6: Trang chủ — danh sách truyện + tìm kiếm

**Files:**
- Modify: `app/page.tsx`
- Create: `components/SearchBox.tsx`

**Interfaces:**
- Consumes: `taoSupabaseServerClient()` (Task 1), bảng `truyen` (Task 2).

- [ ] **Step 1: Viết `components/SearchBox.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBox({ defaultValue }: { defaultValue: string }) {
  const [gia, setGia] = useState(defaultValue);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (gia.trim()) params.set('q', gia.trim());
    router.push(`/?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={gia}
        onChange={(e) => setGia(e.target.value)}
        placeholder="Tìm truyện theo tên..."
        className="border rounded px-3 py-2 flex-1 bg-transparent"
      />
      <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">
        Tìm
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Viết `app/page.tsx`**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import SearchBox from '@/components/SearchBox';

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await taoSupabaseServerClient();

  let query = supabase
    .from('truyen')
    .select('id, ten, slug, anh_bia, trang_thai')
    .order('created_at', { ascending: false });
  if (q) {
    query = query.ilike('ten', `%${q}%`);
  }
  const { data: dsTruyen } = await query;

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Truyện dịch AI</h1>
      <SearchBox defaultValue={q ?? ''} />
      <ul className="mt-4 space-y-2">
        {(dsTruyen ?? []).map((truyen) => (
          <li key={truyen.id}>
            <Link href={`/truyen/${truyen.slug}`} className="text-lg hover:underline">
              {truyen.ten}
            </Link>
            <span className="ml-2 text-sm text-gray-500">
              {truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
            </span>
          </li>
        ))}
        {dsTruyen?.length === 0 && <li className="text-gray-500">Không tìm thấy truyện nào.</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Verify — chạy dev server, mở trình duyệt**

```bash
npm run dev
```
Mở `http://localhost:3000` (dùng `preview_start`): thấy truyện đã đăng ở Task 5 hiện ra. Gõ 1 phần
tên vào ô tìm kiếm, bấm Tìm, xác nhận URL đổi thành `/?q=...` và kết quả lọc đúng. Gõ tên không tồn
tại, xác nhận hiện "Không tìm thấy truyện nào."

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/SearchBox.tsx
git commit -m "feat: trang chu - danh sach truyen + tim kiem"
```

---

### Task 7: Trang truyện — mô tả + danh sách chương + đọc tiếp

**Files:**
- Create: `app/truyen/[slug]/page.tsx`

**Interfaces:**
- Consumes: `taoSupabaseServerClient()` (Task 1), bảng `truyen`/`chuong`/`tien_do_doc` (Task 2).

- [ ] **Step 1: Viết `app/truyen/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

export default async function TrangTruyen({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data: truyen } = await supabase
    .from('truyen')
    .select('id, ten, mo_ta, anh_bia, trang_thai')
    .eq('slug', slug)
    .maybeSingle();

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
    const { data } = await supabase
      .from('tien_do_doc')
      .select('chuong:chuong_id(so_chuong)')
      .eq('user_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    chuongDangDoc = (data?.chuong as { so_chuong: number } | null) ?? null;
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold">{truyen.ten}</h1>
      {truyen.mo_ta && <p className="mt-2 text-gray-600">{truyen.mo_ta}</p>}
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

- [ ] **Step 2: Verify — chạy dev server, mở trình duyệt**

```bash
npm run dev
```
Mở `http://localhost:3000/truyen/ta-tu-hao-a-ta-tu-thang-cap-khoai` (dùng `preview_start`): thấy
tên truyện, mô tả, danh sách 141 chương theo đúng thứ tự số. Click 1 chương → xác nhận điều hướng
sang `/truyen/.../chuong/<so>` (trang chưa tồn tại, sẽ 404 tạm thời — sẽ hết ở Task 8). Mở URL với
slug không tồn tại (vd `/truyen/khong-ton-tai`) → xác nhận hiện trang 404 mặc định của Next.js.

- [ ] **Step 3: Commit**

```bash
git add app/truyen/[slug]/page.tsx
git commit -m "feat: trang truyen - mo ta + danh sach chuong + nut doc tiep"
```

---

### Task 8: Trang đọc chương + lưu tiến độ đọc

**Files:**
- Create: `app/truyen/[slug]/chuong/[so]/page.tsx`
- Create: `app/truyen/[slug]/chuong/[so]/actions.ts`
- Create: `app/truyen/[slug]/chuong/[so]/LuuTienDo.tsx`

**Interfaces:**
- Consumes: `taoSupabaseServerClient()` (Task 1), bảng `chuong`/`tien_do_doc` (Task 2).
- Produces: Server Action `luuTienDoDoc(truyenId: string, chuongId: string): Promise<void>`.

- [ ] **Step 1: Viết `app/truyen/[slug]/chuong/[so]/actions.ts`**

```ts
'use server';

import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function luuTienDoDoc(truyenId: string, chuongId: string) {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('tien_do_doc').upsert({
    user_id: user.id,
    truyen_id: truyenId,
    chuong_id: chuongId,
    updated_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Viết `app/truyen/[slug]/chuong/[so]/LuuTienDo.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { luuTienDoDoc } from './actions';

export default function LuuTienDo({
  truyenId,
  chuongId,
}: {
  truyenId: string;
  chuongId: string;
}) {
  useEffect(() => {
    luuTienDoDoc(truyenId, chuongId);
  }, [truyenId, chuongId]);

  return null;
}
```

- [ ] **Step 3: Viết `app/truyen/[slug]/chuong/[so]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import LuuTienDo from './LuuTienDo';

export default async function TrangDocChuong({
  params,
}: {
  params: Promise<{ slug: string; so: string }>;
}) {
  const { slug, so } = await params;
  const soChuong = parseInt(so, 10);
  const supabase = await taoSupabaseServerClient();

  const { data: truyen } = await supabase
    .from('truyen')
    .select('id, ten')
    .eq('slug', slug)
    .maybeSingle();
  if (!truyen) notFound();

  const { data: chuong } = await supabase
    .from('chuong')
    .select('id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyen.id)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (!chuong) notFound();

  const [{ data: chuongTruoc }, { data: chuongSau }] = await Promise.all([
    supabase
      .from('chuong')
      .select('so_chuong')
      .eq('truyen_id', truyen.id)
      .lt('so_chuong', soChuong)
      .order('so_chuong', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('chuong')
      .select('so_chuong')
      .eq('truyen_id', truyen.id)
      .gt('so_chuong', soChuong)
      .order('so_chuong', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <main className="max-w-2xl mx-auto p-4">
      <LuuTienDo truyenId={truyen.id} chuongId={chuong.id} />
      <p className="text-sm text-gray-500">
        <Link href={`/truyen/${slug}`} className="hover:underline">
          {truyen.ten}
        </Link>
      </p>
      <h1 className="text-xl font-bold mt-1">
        Chương {chuong.so_chuong}: {chuong.tieu_de}
      </h1>
      <article className="mt-4 whitespace-pre-line leading-relaxed">{chuong.noi_dung}</article>
      <nav className="mt-6 flex justify-between">
        {chuongTruoc ? (
          <Link href={`/truyen/${slug}/chuong/${chuongTruoc.so_chuong}`} className="hover:underline">
            ← Chương trước
          </Link>
        ) : (
          <span />
        )}
        {chuongSau ? (
          <Link href={`/truyen/${slug}/chuong/${chuongSau.so_chuong}`} className="hover:underline">
            Chương sau →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: Verify — chạy dev server, mở trình duyệt (chưa đăng nhập)**

Mở `http://localhost:3000/truyen/ta-tu-hao-a-ta-tu-thang-cap-khoai/chuong/1`: xác nhận đọc được
nội dung chương 1, nút "Chương sau →" hoạt động (chương trước phải ẩn vì đây là chương nhỏ nhất).
Mở chương 150 (chương lớn nhất): xác nhận "Chương trước" hiện, "Chương sau" ẩn. Mở số chương không
tồn tại (vd 999): xác nhận 404.

- [ ] **Step 5: Commit**

```bash
git add "app/truyen/[slug]/chuong/[so]"
git commit -m "feat: trang doc chuong + luu tien do doc"
```

---

### Task 9: Đăng ký / Đăng nhập + Header + middleware refresh session

**Files:**
- Create: `middleware.ts`
- Create: `app/dang-ky/page.tsx`
- Create: `app/dang-nhap/page.tsx`
- Create: `components/Header.tsx`
- Create: `components/NutDangXuat.tsx`
- Modify: `app/layout.tsx` (thêm `<Header />`)

**Interfaces:**
- Consumes: `taoSupabaseClient()` (Task 1, browser), `taoSupabaseServerClient()` (Task 1, server).

- [ ] **Step 1: Viết `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Viết `app/dang-ky/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';

export default function TrangDangKy() {
  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    const supabase = taoSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password: matKhau });
    if (error) {
      setLoi(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Đăng ký</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border rounded px-3 py-2 w-full bg-transparent"
        />
        <input
          type="password"
          required
          minLength={6}
          value={matKhau}
          onChange={(e) => setMatKhau(e.target.value)}
          placeholder="Mật khẩu (tối thiểu 6 ký tự)"
          className="border rounded px-3 py-2 w-full bg-transparent"
        />
        {loi && <p className="text-red-600 text-sm">{loi}</p>}
        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white w-full">
          Đăng ký
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Viết `app/dang-nhap/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';

export default function TrangDangNhap() {
  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    const supabase = taoSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: matKhau });
    if (error) {
      setLoi(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Đăng nhập</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border rounded px-3 py-2 w-full bg-transparent"
        />
        <input
          type="password"
          required
          value={matKhau}
          onChange={(e) => setMatKhau(e.target.value)}
          placeholder="Mật khẩu"
          className="border rounded px-3 py-2 w-full bg-transparent"
        />
        {loi && <p className="text-red-600 text-sm">{loi}</p>}
        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white w-full">
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Viết `components/NutDangXuat.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';

export default function NutDangXuat() {
  const router = useRouter();

  async function dangXuat() {
    const supabase = taoSupabaseClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button onClick={dangXuat} className="hover:underline">
      Đăng xuất
    </button>
  );
}
```

- [ ] **Step 5: Viết `components/Header.tsx`**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import NutDangXuat from './NutDangXuat';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="max-w-3xl mx-auto p-4 flex justify-between items-center">
      <Link href="/" className="font-bold">
        Truyện dịch AI
      </Link>
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
    </header>
  );
}
```

(Nút dark mode sẽ được thêm vào `<Header />` ở Task 10.)

- [ ] **Step 6: Sửa `app/layout.tsx` thêm `<Header />`**

```tsx
import './globals.css';
import Header from '@/components/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify — luồng đăng ký/đăng nhập/đăng xuất đầy đủ**

```bash
npm run dev
```
Dùng trình duyệt (`preview_start` rồi `computer`/`find`/`form_input`):
1. Vào `/dang-ky`, đăng ký 1 email test + mật khẩu → xác nhận redirect về `/`, Header hiện
   "Đăng xuất" thay vì "Đăng nhập/Đăng ký".
2. Bấm "Đăng xuất" → xác nhận Header hiện lại "Đăng nhập/Đăng ký".
3. Vào `/dang-nhap`, đăng nhập lại đúng email/mật khẩu vừa tạo → xác nhận vào lại được, Header
   đổi trạng thái đúng.
4. Trong Supabase Dashboard → Authentication → Users: xác nhận thấy user vừa tạo.
5. Đăng nhập, mở lại trang đọc chương ở Task 8 (vd chương 1) rồi vào trang truyện → xác nhận nút
   "Đọc tiếp Chương 1" xuất hiện (kiểm tra bảng `tien_do_doc` trong Supabase có đúng 1 dòng).

- [ ] **Step 8: Commit**

```bash
git add middleware.ts app/dang-ky app/dang-nhap components/Header.tsx components/NutDangXuat.tsx app/layout.tsx
git commit -m "feat: dang ky/dang nhap/dang xuat + middleware refresh session"
```

---

### Task 10: Dark mode

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/Header.tsx`
- Create: `components/ThemeToggle.tsx`

**Interfaces:**
- Không phụ thuộc task khác ngoài `Header.tsx` (Task 9) để gắn nút toggle vào.

- [ ] **Step 1: Viết `components/ThemeToggle.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const luu = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    setTheme(luu);
    document.documentElement.setAttribute('data-theme', luu);
  }, []);

  function doiTheme() {
    const moi = theme === 'light' ? 'dark' : 'light';
    setTheme(moi);
    localStorage.setItem('theme', moi);
    document.documentElement.setAttribute('data-theme', moi);
  }

  return (
    <button onClick={doiTheme} aria-label="Đổi giao diện sáng/tối">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

- [ ] **Step 2: Sửa `app/globals.css` thêm biến theme**

Thêm vào đầu file (giữ nguyên phần Tailwind import có sẵn từ `create-next-app`):

```css
:root {
  --bg: #ffffff;
  --fg: #111111;
}

[data-theme='dark'] {
  --bg: #111111;
  --fg: #f5f5f5;
}

body {
  background: var(--bg);
  color: var(--fg);
}
```

- [ ] **Step 3: Sửa `app/layout.tsx` — thêm script inline set theme trước hydrate**

```tsx
import './globals.css';
import Header from '@/components/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme') || 'light';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Sửa `components/Header.tsx` — thêm `<ThemeToggle />`**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import NutDangXuat from './NutDangXuat';
import ThemeToggle from './ThemeToggle';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="max-w-3xl mx-auto p-4 flex justify-between items-center">
      <Link href="/" className="font-bold">
        Truyện dịch AI
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
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
    </header>
  );
}
```

- [ ] **Step 5: Verify — bấm toggle, reload trang, xác nhận giữ theme**

Mở trang chủ, bấm icon 🌙/☀️ ở Header → xác nhận nền/chữ đổi màu ngay. Reload lại trang (F5) →
xác nhận theme vừa chọn KHÔNG bị reset về light (đây là điểm dễ lỗi nhất theo lưu ý kỹ thuật đã ghi
trong `app-web-sk` — nếu bị mất theme sau reload, kiểm tra lại `useEffect` trong `ThemeToggle.tsx`
có thực sự set lại `data-theme` hay không).

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css components/Header.tsx components/ThemeToggle.tsx
git commit -m "feat: dark mode toggle"
```

---

### Task 11: Deploy lên Vercel (MANUAL — user tự làm)

**Files:** không có file code mới; chỉ hướng dẫn thao tác.

- [ ] **Step 1 (MANUAL): Đẩy code lên GitHub**

Tạo 1 repo mới (private hoặc public tuỳ bạn) trên GitHub, rồi:

```bash
git remote add origin <URL-repo-GitHub-cua-ban>
git push -u origin master
```

- [ ] **Step 2 (MANUAL): Import project vào Vercel**

Vào https://vercel.com, đăng nhập (khuyến khích đăng nhập bằng GitHub cho tiện), bấm **Add New →
Project**, chọn đúng repo vừa push.

- [ ] **Step 3 (MANUAL): Khai báo biến môi trường trong Vercel**

Trong màn hình cấu hình project (hoặc Project Settings → Environment Variables sau khi tạo), thêm
đúng các biến sau (lấy giá trị từ `.env.local` ở Task 1 — **không thêm `SUPABASE_SERVICE_ROLE_KEY`
vào Vercel**, vì key này chỉ dùng để chạy `sync-truyen.mjs` ở máy local, không cần và không nên
đưa lên server web công khai):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

- [ ] **Step 4 (MANUAL): Deploy**

Bấm **Deploy**. Sau khi build xong, Vercel cấp 1 domain dạng `<ten-project>.vercel.app` — mở thử
domain đó, kiểm tra lại các luồng chính (danh sách truyện, đọc chương, đăng ký/đăng nhập, dark
mode) hoạt động giống hệt lúc chạy `npm run dev` ở local.

---

## Self-Review (đã thực hiện khi viết plan này)

- **Spec coverage:** đối chiếu với `docs/superpowers/specs/2026-09-08-website-truyen-design.md` —
  đủ cả 5 route (trang chủ, trang truyện, trang chương, đăng ký, đăng nhập), đủ 3 bảng DB, đủ cơ
  chế đồng bộ "check [tên truyện]" (Task 5), dark mode (Task 10), lưu tiến độ đọc (Task 8). Phần
  "ngoài phạm vi" (trả phí, audio) không có task nào động tới — đúng ý định.
- **Placeholder scan:** không còn "TBD"/"implement later" — mọi step có code đầy đủ.
- **Type consistency:** `taoSupabaseClient`/`taoSupabaseServerClient` (Task 1) dùng nhất quán ở
  Task 6-9; `taoSlug`/`parseChuong` (Task 3-4) dùng đúng tên/chữ ký hàm ở Task 5; cột DB
  (`so_chuong`, `tieu_de`, `noi_dung`, `truyen_id`, `chuong_id`, `user_id`) dùng nhất quán xuyên
  suốt Task 2, 5, 6, 7, 8.
