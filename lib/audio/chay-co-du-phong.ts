// Chạy 1 tác vụ hay bị "treo ngẫu nhiên" (msedge-tts) theo kiểu có dự phòng: nếu lần chạy đầu chưa xong sau
// `hedgeSauMs` thì chạy thêm 1 lần SONG SONG (không đợi lần đầu hết timeout), lần nào xong trước thì lấy kết quả.
// Lần nào thất bại thì lập tức thử lần tiếp theo (tới `soLanToiDa`, trong `nganSachTongMs`). Đo thật: đoạn treo
// chờ hết timeout 18s rồi mới thử lại là nguyên nhân người nghe bị đứng 10-15 giây ở tốc độ 1.5x.
export type CauHinhDuPhong = {
  soLanToiDa: number;
  hedgeSauMs: number;
  timeoutMotLanMs: number;
  nganSachTongMs: number;
  toiThieuMotLanMs: number;
};

// Số liệu chẩn đoán (tuỳ chọn): cho biết đã phát mấy lần chạy và lần thứ mấy thắng, để phát hiện "lần đầu hay treo".
export type ThongKeDuPhong = { soLanPhat: number; lanThang: number };

export function chayCoDuPhong<T>(
  thuMot: (timeoutMs: number) => Promise<T>,
  cauHinh: CauHinhDuPhong,
  thongKe?: ThongKeDuPhong
): Promise<T> {
  const batDau = Date.now();
  return new Promise<T>((xong, loi) => {
    let daPhat = 0;
    let soThatBai = 0;
    let daKetThuc = false;
    let loiCuoi: unknown;
    let boDemHedge: ReturnType<typeof setTimeout> | undefined;

    const ketThuc = () => {
      daKetThuc = true;
      if (boDemHedge) clearTimeout(boDemHedge);
    };

    // Trả true nếu đã phát thêm được 1 lần chạy.
    const phatThem = (): boolean => {
      if (daKetThuc || daPhat >= cauHinh.soLanToiDa) return false;
      const conLaiMs = cauHinh.nganSachTongMs - (Date.now() - batDau);
      if (conLaiMs < cauHinh.toiThieuMotLanMs) return false;

      daPhat += 1;
      const lanSo = daPhat;
      if (thongKe) thongKe.soLanPhat = daPhat;
      thuMot(Math.min(cauHinh.timeoutMotLanMs, conLaiMs)).then(
        (ketQua) => {
          if (daKetThuc) return;
          if (thongKe) thongKe.lanThang = lanSo;
          ketThuc();
          xong(ketQua);
        },
        (err) => {
          loiCuoi = err;
          soThatBai += 1;
          if (daKetThuc || soThatBai < daPhat) return; // vẫn còn lần khác đang chạy
          if (!phatThem()) {
            ketThuc();
            loi(loiCuoi instanceof Error ? loiCuoi : new Error(String(loiCuoi)));
          }
        }
      );

      if (boDemHedge) clearTimeout(boDemHedge);
      boDemHedge = setTimeout(phatThem, cauHinh.hedgeSauMs);
      return true;
    };

    if (!phatThem()) {
      ketThuc();
      loi(new Error('Hết ngân sách thời gian tạo đoạn audio'));
    }
  });
}
