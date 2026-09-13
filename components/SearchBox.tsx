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
    <form onSubmit={submit} className="flex gap-2 flex-1">
      <input
        type="text"
        value={gia}
        onChange={(e) => setGia(e.target.value)}
        placeholder="Tìm truyện theo tên..."
        className="border border-border rounded-full px-3 py-1.5 text-sm flex-1 bg-background"
      />
      <button
        type="submit"
        className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
      >
        Tìm
      </button>
    </form>
  );
}
