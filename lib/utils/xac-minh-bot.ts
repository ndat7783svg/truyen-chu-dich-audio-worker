export function layIpTuHeader(header: string | null): string | null {
  if (!header) return null;
  const ip = header.split(',')[0]?.trim();
  return ip || null;
}

function ipv4ThanhSo(ip: string): number | null {
  const phan = ip.split('.').map(Number);
  if (phan.length !== 4 || phan.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((phan[0] << 24) | (phan[1] << 16) | (phan[2] << 8) | phan[3]) >>> 0;
}

export function ipTrongDaiCidr(ip: string, cidr: string): boolean {
  const [dai, bitStr] = cidr.split('/');
  const bit = parseInt(bitStr, 10);
  if (!dai || Number.isNaN(bit) || bit < 0 || bit > 32) return false;

  const ipSo = ipv4ThanhSo(ip);
  const daiSo = ipv4ThanhSo(dai);
  if (ipSo === null || daiSo === null) return false;

  const mask = bit === 0 ? 0 : (~0 << (32 - bit)) >>> 0;
  return (ipSo & mask) === (daiSo & mask);
}

export function ipTrongDanhSach(ip: string, danhSachCidr: string[]): boolean {
  return danhSachCidr.some((cidr) => ipTrongDaiCidr(ip, cidr));
}
