'use client';

export default function LoiChung({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="w-full max-w-md mx-auto p-6 text-center space-y-4 mt-12">
      <h1 className="text-xl font-bold">Có lỗi tạm thời</h1>
      <p className="text-muted-foreground">
        Trang tải chưa được do lỗi kết nối tạm thời, không phải trang không tồn tại. Thử lại giúp
        bạn.
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
      >
        Thử lại
      </button>
    </main>
  );
}
