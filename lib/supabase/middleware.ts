import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session and gates the app behind login.
// Public paths skip the auth call entirely, and the auth check is guarded by a
// timeout, so a slow/unreachable Supabase can't hang the middleware (which
// would 504 the whole site — including the login page).
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/_next") ||
    path.startsWith("/icon") ||
    path.startsWith("/apple-icon") ||
    path.startsWith("/manifest") ||
    path === "/favicon.ico";

  let response = NextResponse.next({ request });

  // Public paths are always reachable, even if Supabase is down.
  if (isPublic) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Fail fast if Supabase is unresponsive rather than hanging the request.
  let user = null;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("auth-timeout")), 4000)
      ),
    ]);
    user = result.data.user;
  } catch {
    user = null;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
