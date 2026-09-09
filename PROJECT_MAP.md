# PROJECT_MAP.md

Bản đồ kiến trúc dự án website đọc truyện (đã hoàn thành Task 1 scaffold).

## Cấu trúc thực tế
```
website truyện chữ AI/
├── CLAUDE.md                 (mục đích + quy tắc dự án)
├── PROJECT_MAP.md             (file này - bản đồ kiến trúc tra cứu nhanh)
├── HANDOFF.md                 (mục lục nhật ký kỹ thuật)
├── NEXT_SESSION.md            (bàn giao phiên đang dở)
├── docs/                      (tài liệu specs, plans, handoff)
├── app/                       (Next.js App Router - giao diện và routing)
│   ├── layout.tsx             (root layout)
│   ├── page.tsx               (placeholder trang chủ)
│   └── globals.css            (cấu hình CSS Tailwind)
├── lib/
│   └── supabase/              (helper kết nối Supabase)
│       ├── client.ts          (taoSupabaseClient - dùng trong Client Component)
│       └── server.ts          (taoSupabaseServerClient - dùng trong Server Component/Action)
├── __smoke__/                 (smoke test)
│   └── smoke.test.ts          (test Vitest cơ bản)
├── .env.local.example         (mẫu biến môi trường commit vào repo)
├── .env.local                 (biến môi trường local - gitignore)
├── vitest.config.ts           (cấu hình test Vitest)
├── next.config.ts             (cấu hình Next.js)
├── tsconfig.json              (cấu hình TypeScript)
└── package.json               (dependencies + scripts: dev, build, test, lint)
```

## Nguồn dữ liệu ngoài
- `D:\translate truyen\danh-sach-truyen\[Tên truyện]\chuong\chuong-XXX.md` — chương truyện đã dịch,
  dòng đầu là `# Chương [Số]: [Tiêu đề]`, phần còn lại là nội dung. Dự án này CHỈ ĐỌC, không sửa.
