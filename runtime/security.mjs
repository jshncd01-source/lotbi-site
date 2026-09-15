export class RequestSecurityError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'RequestSecurityError';
    this.status = status;
    this.code = code;
  }
}

export function assertTrustedSameOriginPost(request, expectedOrigin) {
  if (request.method !== 'POST') throw new RequestSecurityError(405, 'METHOD_NOT_ALLOWED', 'POST is required');
  const origin = request.headers.get('origin');
  if (origin !== expectedOrigin) throw new RequestSecurityError(403, 'BFF_ORIGIN_REJECTED', 'Request origin was rejected');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    throw new RequestSecurityError(403, 'BFF_FETCH_SITE_REJECTED', 'Cross-site browser request was rejected');
  }
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw new RequestSecurityError(415, 'CONTENT_TYPE_REQUIRED', 'application/json is required');
  }
}

export function jsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Vary': 'Origin, Cookie',
    ...extra,
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {status, headers: jsonHeaders(extraHeaders)});
}
