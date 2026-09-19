// Chrome mới báo canPlayType HLS = "có" nhưng KHÔNG phát được đoạn MP3 thuần (đã gặp thật 2026-09-19),
// nên chọn theo user-agent thay vì canPlayType: Safari/iOS -> HLS gốc, còn lại -> hls.js.
export function nenDungHlsGoc(userAgent: string): boolean {
  const laIos = /iPad|iPhone|iPod/.test(userAgent);
  const laSafari =
    /safari/i.test(userAgent) && !/chrome|chromium|android|edg|crios|fxios/i.test(userAgent);
  return laIos || laSafari;
}
