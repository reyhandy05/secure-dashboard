import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/", "/incidents", "/assets", "/team"];

export default function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // CSP yang kompatibel dengan Next.js App Router, Google Fonts, dan Supabase
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://api.resend.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  const pathname = request.nextUrl.pathname;
  const sessionCookie = 
    request.cookies.get("auth_session") ?? 
    request.cookies.get("authjs.session-token") ?? 
    request.cookies.get("__Secure-authjs.session-token");

  if (protectedPaths.includes(pathname) && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return response;
}

export const config = { 
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"] 
};