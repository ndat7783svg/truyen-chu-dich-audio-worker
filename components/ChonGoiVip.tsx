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
        className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:opacity-90"
      >
        Mua gói VIP
      </button>
      {moModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5 text-left sm:rounded-2xl">
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
                      className="flex w-full items-center justify-between rounded-xl border border-border p-3.5 hover:border-accent disabled:opacity-60"
                    >
                      <span>
                        {goi.ten} ({goi.soNgay} ngày)
                      </span>
                      <span className="font-bold text-accent">{goi.gia.toLocaleString('vi-VN')}đ</span>
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
                <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-white">
                  <Image
                    src="/qr-nhan-tien-momo.png"
                    alt="QR nhận tiền MoMo"
                    fill
                    sizes="320px"
                    className="object-contain"
                  />
                </div>
                <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
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
                  <strong className="text-accent">{trangThai.maGiaoDich}</strong>{' '}
                  <button
                    type="button"
                    onClick={() => copyVaoClipboard('maGiaoDich', trangThai.maGiaoDich)}
                    className="text-xs text-accent underline"
                  >
                    {truongDaCopy === 'maGiaoDich' ? 'Đã copy' : 'Copy'}
                  </button>
                </p>
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  Thanh toán của bạn đang được xử lý. Việc xử lý có thể bị chậm khoảng 5 - 20 phút,
                  vui lòng chờ đợi. Ngoài ra, thanh toán sẽ không được xử lý trong khung giờ từ 23h
                  đến 6h sáng hôm sau.
                </p>
              </>
            )}
            {trangThai.buoc === 'loi' && <p className="text-sm text-red-600">{trangThai.thongBao}</p>}
            <button
              type="button"
              onClick={() => setMoModal(false)}
              className="h-11 w-full rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface"
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
        className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs hover:border-accent"
      >
        {daCopy ? 'Đã copy' : 'Copy'}
      </button>
    </div>
  );
}
