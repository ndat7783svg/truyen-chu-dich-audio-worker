// Chia văn bản chương thành các đoạn nhỏ để tạo audio theo từng đoạn (HLS). Hàm phải XÁC ĐỊNH: route
// playlist và route đoạn cùng gọi chiaDoan() với cùng dữ liệu nên phải ra cùng danh sách đoạn.
export const GIOI_HAN_DOAN_DAU = 100; // đoạn đầu ngắn để bắt đầu phát sau ~1-5 giây
export const GIOI_HAN_DOAN_SAU = 200;
export const GIOI_HAN_CUNG = 250; // câu dài hơn mức này bị cắt cứng tại khoảng trắng

// Hồi quy từ 17 mẫu đo thật (msedge-tts, giọng HoaiMy): 0.0586 giây/ký tự + 0.73 giây cố định/đoạn.
const SO_KY_TU_MOI_GIAY = 17.1;
const GIAY_CO_DINH_MOI_DOAN = 0.73;

export function uocThoiLuongGiay(doan: string): number {
  return doan.length / SO_KY_TU_MOI_GIAY + GIAY_CO_DINH_MOI_DOAN;
}

function tachCau(vanBan: string): string[] {
  return vanBan
    .split(/(?<=[.!?…。！？”"])\s+|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function catCung(cau: string, toiDa: number): string[] {
  const ketQua: string[] = [];
  let conLai = cau;
  while (conLai.length > toiDa) {
    let viTri = conLai.lastIndexOf(' ', toiDa);
    if (viTri < toiDa / 2) viTri = toiDa; // không có khoảng trắng hợp lý → cắt thẳng
    ketQua.push(conLai.slice(0, viTri).trim());
    conLai = conLai.slice(viTri).trim();
  }
  if (conLai) ketQua.push(conLai);
  return ketQua;
}

export function chiaDoan(tieuDe: string, noiDung: string): string[] {
  const vanBan = `${tieuDe}. ${noiDung}`.replace(/[ \t]+/g, ' ').trim();
  const cacCau = tachCau(vanBan).flatMap((c) => catCung(c, GIOI_HAN_CUNG));

  const ketQua: string[] = [];
  let hienTai = '';
  for (const cau of cacCau) {
    const gioiHan = ketQua.length === 0 ? GIOI_HAN_DOAN_DAU : GIOI_HAN_DOAN_SAU;
    if (hienTai && hienTai.length + 1 + cau.length > gioiHan) {
      ketQua.push(hienTai);
      hienTai = cau;
    } else {
      hienTai = hienTai ? `${hienTai} ${cau}` : cau;
    }
  }
  if (hienTai) ketQua.push(hienTai);
  return ketQua;
}
