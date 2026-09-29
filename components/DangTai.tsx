// Khung xương hiển thị trong lúc chờ trang tải (dùng trong các file loading.tsx).
export default function DangTai() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse px-4 py-6" aria-busy="true" aria-label="Đang tải">
      <div className="flex gap-4">
        <div className="aspect-[2/3] w-28 shrink-0 rounded-lg bg-surface" />
        <div className="flex-1 space-y-3 pt-2">
          <div className="h-5 w-3/4 rounded bg-surface" />
          <div className="h-4 w-1/2 rounded bg-surface" />
          <div className="h-4 w-2/3 rounded bg-surface" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-4 rounded bg-surface" />
        <div className="h-4 rounded bg-surface" />
        <div className="h-4 w-5/6 rounded bg-surface" />
      </div>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}
