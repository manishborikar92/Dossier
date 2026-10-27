import { NextResponse, type NextRequest } from 'next/server';

/**
 * Dossier has no login: it is meant to run on your own computer. This guard keeps it that way
 * even if something on your network, or a website open in your browser, tries to reach it.
 *
 *  - Only requests addressed to localhost / 127.0.0.1 / [::1] are served (DNS-rebinding protection).
 *    Add other host names with ALLOWED_HOSTS if you deliberately expose the app.
 *  - Requests that change data must come from this app's own pages (same-origin protection).
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function extraHosts(): Set<string> {
  return new Set(
    (process.env.ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

const forbidden = (why: string) => new NextResponse(`Forbidden: ${why}`, { status: 403 });

export function proxy(request: NextRequest) {
  const hostHeader = (request.headers.get('host') ?? '').toLowerCase();
  // Next.js internal subrequests (such as image optimization) run in-process without an external host header.
  if (!hostHeader) {
    return NextResponse.next();
  }
  const hostname = hostHeader.replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(hostname) && !extraHosts().has(hostname)) {
    return forbidden('this app only answers requests addressed to localhost');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        return forbidden('invalid origin');
      }
      if (originHost !== hostHeader) return forbidden('cross-site request blocked');
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') return forbidden('cross-site request blocked');
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'] };
