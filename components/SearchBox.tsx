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
