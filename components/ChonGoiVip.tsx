'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DANH_SACH_GOI, THONG_TIN_NHAN_TIEN, type MaGoi } from '@/lib/config/goi-vip';
import { taoGiaoDich } from '@/app/tai-khoan/actions-goi-vip';

type TrangThaiModal =
  | { buoc: 'chon-goi' }
  | { buoc: 'huong-dan'; maGiaoDich: string; soTien: number; tenGoi: string }
  | { buoc: 'loi'; thongBao: string };

export default function ChonGoiVip() {
  const [moModal, setMoModal] = useState(false);
  const [trangThai, setTrangThai] = useState<TrangThaiModal>({ buoc: 'chon-goi' });
  const [dangXuLy, setDangXuLy] = useState(false);
  const [truongDaCopy, setTruongDaCopy] = useState<string | null>(null);

  async function copyVaoClipboard(truong: string, giaTri: string) {
    try {
      await navigator.clipboard.writeText(giaTri);
      setTruongDaCopy(truong);
      setTimeout(() => setTruongDaCopy((hienTai) => (hienTai === truong ? null : hienTai)), 1500);
    } catch {
      // Clipboard không khả dụng (trình duyệt cũ/không phải HTTPS) - user tự bôi đen copy tay.
    }
  }

  function moLai() {
    setTrangThai({ buoc: 'chon-goi' });
    setMoModal(true);
  }

  async function chonGoi(ma: MaGoi) {
    if (dangXuLy) return;
    setDangXuLy(true);
    const ketQua = await taoGiaoDich(ma);
    if (ketQua.thanhCong) {
      setTrangThai({
        buoc: 'huong-dan',
        maGiaoDich: ketQua.maGiaoDich,
        soTien: ketQua.soTien,
        tenGoi: ketQua.tenGoi,
      });
    } else {
      setTrangThai({ buoc: 'loi', thongBao: ketQua.loi });
    }
    setDangXuLy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={moLai}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
      >
        Mua gói VIP
      </button>
      {moModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-lg p-4 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            {trangThai.buoc === 'chon-goi' && (
              <>
                <h2 className="text-lg font-semibold">Chọn gói VIP</h2>
                <p className="text-xs text-muted-foreground">
                  Mở đọc không giới hạn chương ở mọi truyện trong thời gian gói hiệu lực.
                </p>
                <div className="space-y-2">
                  {DANH_SACH_GOI.map((goi) => (
                    <button
                      key={goi.ma}
                      type="button"
                      disabled={dangXuLy}
                      onClick={() => chonGoi(goi.ma)}
                      className="w-full flex justify-between items-center border border-border rounded p-3 hover:bg-black/5 disabled:opacity-60"
                    >
                      <span>
                        {goi.ten} ({goi.soNgay} ngày)
                      </span>
                      <span className="font-semibold">{goi.gia.toLocaleString('vi-VN')}đ</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {trangThai.buoc === 'huong-dan' && (
              <>
                <h2 className="text-lg font-semibold">Chuyển khoản để kích hoạt</h2>
                <p className="text-sm">
                  Gói: <strong>{trangThai.tenGoi}</strong> — Số tiền:{' '}
                  <strong>{trangThai.soTien.toLocaleString('vi-VN')}đ</strong>
                </p>
                <div className="relative w-full aspect-square bg-surface rounded overflow-hidden">
                  <Image
                    src="/qr-nhan-tien-momo.png"
                    alt="QR nhận tiền MoMo"
                    fill
                    sizes="320px"
                    className="object-contain"
                  />
                </div>
                <div className="text-sm border border-border rounded p-3 space-y-2">
                  <DongThongTinCopy
                    nhan="Tên người nhận"
                    giaTri={THONG_TIN_NHAN_TIEN.tenNguoiNhan}
                    daCopy={truongDaCopy === 'ten'}
                    onCopy={() => copyVaoClipboard('ten', THONG_TIN_NHAN_TIEN.tenNguoiNhan)}
                  />
                  <DongThongTinCopy
                    nhan="Ngân hàng"
                    giaTri={THONG_TIN_NHAN_TIEN.nganHang}
                    daCopy={truongDaCopy === 'nganHang'}
                    onCopy={() => copyVaoClipboard('nganHang', THONG_TIN_NHAN_TIEN.nganHang)}
                  />
                  <DongThongTinCopy
                    nhan="Số tài khoản"
                    giaTri={THONG_TIN_NHAN_TIEN.soTaiKhoan}
                    daCopy={truongDaCopy === 'stk'}
                    onCopy={() => copyVaoClipboard('stk', THONG_TIN_NHAN_TIEN.soTaiKhoan)}
                  />
                </div>
                <p className="text-sm">
                  Chuyển khoản đúng số tiền, nội dung ghi chính xác:{' '}
                  <strong className="text-blue-600">{trangThai.maGiaoDich}</strong>{' '}
                  <button
                    type="button"
                    onClick={() => copyVaoClipboard('maGiaoDich', trangThai.maGiaoDich)}
                    className="text-xs underline text-blue-600"
                  >
                    {truongDaCopy === 'maGiaoDich' ? 'Đã copy' : 'Copy'}
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sau khi chuyển khoản, gói sẽ được kích hoạt trong ít phút. Bạn có thể đóng cửa sổ
                  này và quay lại sau.
                </p>
              </>
            )}
            {trangThai.buoc === 'loi' && <p className="text-sm text-red-600">{trangThai.thongBao}</p>}
            <button
              type="button"
              onClick={() => setMoModal(false)}
              className="w-full px-4 py-2 rounded border border-border text-sm font-medium"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DongThongTinCopy({
  nhan,
  giaTri,
  daCopy,
  onCopy,
}: {
  nhan: string;
  giaTri: string;
  daCopy: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-muted-foreground">{nhan}</p>
        <p className="font-medium">{giaTri}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 text-xs px-2 py-1 rounded border border-border hover:bg-black/5"
      >
        {daCopy ? 'Đã copy' : 'Copy'}
      </button>
    </div>
  );
}
