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
