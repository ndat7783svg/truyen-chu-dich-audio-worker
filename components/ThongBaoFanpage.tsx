const LINK_FANPAGE = 'https://www.facebook.com/profile.php?id=61594138028999';

export default function ThongBaoFanpage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
        <a
          href={LINK_FANPAGE}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fanpage Facebook"
          className="shrink-0"
        >
          <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
          </svg>
        </a>
        <p>
          Muốn dịch một bộ truyện yêu thích chưa có bản dịch, hoặc gặp sự cố khi đọc truyện?
          Hãy liên hệ với chúng tôi qua{' '}
          <a
            href={LINK_FANPAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            fanpage Facebook
          </a>
          .
        </p>
      </div>
    </div>
  );
}
