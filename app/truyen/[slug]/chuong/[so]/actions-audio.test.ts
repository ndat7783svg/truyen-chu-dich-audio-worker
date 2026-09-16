import { beforeEach, describe, expect, it, vi } from 'vitest';
import { yeuCauTaoAudioNgay } from './actions-audio';

// Mock taoSupabaseServerClient
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  taoSupabaseServerClient: vi.fn().mockImplementation(async () => ({
    rpc: mockRpc,
  })),
}));

describe('actions-audio - yeuCauTaoAudioNgay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_DISPATCH_TOKEN;
  });

  it('gọi RPC xep_hang_tao_audio thành công và trả về thanhCong = true ngay cả khi không có token', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });

    const ketQua = await yeuCauTaoAudioNgay('chuong-uuid-123');

    expect(mockRpc).toHaveBeenCalledWith('xep_hang_tao_audio', {
      p_chuong_id: 'chuong-uuid-123',
    });
    expect(ketQua).toEqual({ thanhCong: true });
  });

  it('trả về lỗi khi RPC xep_hang_tao_audio bị lỗi', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'Lỗi kết nối cơ sở dữ liệu' } });

    const ketQua = await yeuCauTaoAudioNgay('chuong-uuid-123');

    expect(mockRpc).toHaveBeenCalledWith('xep_hang_tao_audio', {
      p_chuong_id: 'chuong-uuid-123',
    });
    expect(ketQua).toEqual({
      thanhCong: false,
      loi: 'Lỗi kết nối cơ sở dữ liệu',
    });
  });

  it('gọi GitHub Actions API khi có GITHUB_DISPATCH_TOKEN và trả về thanhCong = true', async () => {
    process.env.GITHUB_DISPATCH_TOKEN = 'ghp_fake_token_123';
    mockRpc.mockResolvedValueOnce({ error: null });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
    });
    vi.stubGlobal('fetch', mockFetch);

    const ketQua = await yeuCauTaoAudioNgay('chuong-uuid-456');

    expect(ketQua).toEqual({ thanhCong: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/ndat7783svg/truyen-chu-dich-audio-worker/actions/workflows/worker-audio-chuong.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_fake_token_123',
        }),
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            chuong_id: 'chuong-uuid-456',
          },
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('vẫn trả về thanhCong = true khi GitHub Actions API trả về lỗi (fail gracefully)', async () => {
    process.env.GITHUB_DISPATCH_TOKEN = 'ghp_fake_token_123';
    mockRpc.mockResolvedValueOnce({ error: null });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal GitHub error',
    });
    vi.stubGlobal('fetch', mockFetch);

    const ketQua = await yeuCauTaoAudioNgay('chuong-uuid-789');

    expect(ketQua).toEqual({ thanhCong: true });

    vi.unstubAllGlobals();
  });
});
