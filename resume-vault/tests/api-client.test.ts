import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, errorMessage, request, resumeFileUrl } from '@/lib/api';

afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('API client', () => {
  it('returns parsed JSON for successful requests and sends JSON bodies', async () => {
    const fetchMock = respond(200, { fullName: 'Casey' });
    vi.stubGlobal('fetch', fetchMock);
    const result = await api.profile.save({
      fullName: 'Casey',
      headline: '',
      email: '',
      phone: '',
      location: '',
      links: [],
      summaries: [],
    });
    expect(result).toEqual({ fullName: 'Casey' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/profile');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('turns server validation errors into an ApiError with field messages', async () => {
    vi.stubGlobal('fetch', respond(400, { error: 'Enter a valid email address', fields: { email: 'Enter a valid email address' } }));
    const error = (await request('/api/profile', 'PUT', {}).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({ email: 'Enter a valid email address' });
    expect(errorMessage(error)).toBe('Enter a valid email address');
  });

  it('explains when the app cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const error = (await request('/api/resumes').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/still running/);
  });

  it('falls back to a generic message when the server sends no JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>oops</html>', { status: 502 })),
    );
    await expect(request('/api/resumes')).rejects.toThrow('The request failed (502).');
  });

  it('builds file URLs for previews, downloads and saved versions', () => {
    expect(resumeFileUrl(3, 'pdf')).toBe('/api/resumes/3/pdf');
    expect(resumeFileUrl(3, 'docx', { download: true })).toBe('/api/resumes/3/docx?download=1');
    expect(resumeFileUrl(3, 'pdf', { version: 9, download: true })).toBe('/api/resumes/3/pdf?version=9&download=1');
    expect(resumeFileUrl(3, 'pdf', { cacheKey: 7 })).toBe('/api/resumes/3/pdf?ts=7');
  });
});
