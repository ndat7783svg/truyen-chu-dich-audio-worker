const LINK_FANPAGE = 'https://www.facebook.com/profile.php?id=61594138028999';

export default function ThongBaoFanpage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4">
      <a
        href={LINK_FANPAGE}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm hover:opacity-90"
      >
        <svg className="h-5 w-5 shrink-0 text-[#1877f2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
        </svg>
        <p className="min-w-0 flex-1">
          Muốn dịch một bộ truyện yêu thích chưa có bản dịch, hoặc gặp sự cố khi đọc truyện? Hãy liên
          hệ với chúng tôi qua <span className="font-semibold text-accent">fanpage Facebook</span>.
        </p>
      </a>
    </div>
  );
}
