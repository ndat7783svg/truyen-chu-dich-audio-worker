'use client';

import { useEffect, useState } from 'react';
import { docTheme, ghiTheme, type ThemeToanSite } from '@/lib/utils/theme';

const TUY_CHON: { gia: ThemeToanSite; nhan: string }[] = [
  { gia: 'sang', nhan: 'Sáng' },
  { gia: 'giay', nhan: 'Giấy' },
  { gia: 'toi', nhan: 'Tối' },
];

export default function ChonTheme() {
  const [theme, setTheme] = useState<ThemeToanSite>('sang');

  useEffect(() => {
    setTheme(docTheme());
  }, []);

  function doiTheme(themeMoi: ThemeToanSite) {
    setTheme(themeMoi);
    ghiTheme(themeMoi);
    document.documentElement.dataset.theme = themeMoi;
  }

  return (
    <div className="flex gap-2">
      {TUY_CHON.map((tc) => (
        <button
          key={tc.gia}
          type="button"
          onClick={() => doiTheme(tc.gia)}
          className={`flex-1 rounded-xl border p-2.5 text-sm font-medium ${
            theme === tc.gia ? 'border-accent bg-accent-soft text-accent' : 'border-border hover:border-accent'
          }`}
        >
          {tc.nhan}
        </button>
      ))}
    </div>
  );
}
