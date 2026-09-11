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
    <div
      className="relative"
      onMouseEnter={() => setMoRong(true)}
      onMouseLeave={() => setMoRong(false)}
    >
      <button type="button" className="hover:underline">
        Thể loại
      </button>
      {moRong && (
        <ul className="absolute left-0 top-full w-48 rounded border border-border bg-surface shadow-md z-10 max-h-64 overflow-y-auto">
          {dsTheLoai.map((tl) => (
            <li key={tl.slug}>
              <Link
                href={`/the-loai/${tl.slug}`}
                className="block px-3 py-2 hover:bg-background"
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
