import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  decodeJwtAal,
  homePathForRole,
  isStaffRole,
  roleFromUser,
  staffNeedsAal2,
} from "@/lib/auth/roles";
import { getPublicSupabaseConfig, isPublicSupabaseConfigured } from "@/lib/config";
import type { Database } from "@/types/database";

const PUBLIC_PREFIXES = ["/logowanie", "/aktywacja"];

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  let supabaseResponse = NextResponse.next({ request });

  if (!isPublicSupabaseConfigured()) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;
  const role = roleFromUser(user);
  const aal = decodeJwtAal(session?.access_token);
  const needsKey = Boolean(user && staffNeedsAal2(role) && aal !== "aal2");

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = path.startsWith("/aktywacja") ? request.nextUrl.search : "";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  };

  if (!user) {
    if (isPublicPath(pathname) && pathname !== "/logowanie/klucz") {
      return supabaseResponse;
    }
    return redirectTo("/logowanie");
  }

  if (pathname === "/") {
    if (needsKey) return redirectTo("/logowanie/klucz");
    return redirectTo(homePathForRole(role));
  }

  if (pathname === "/logowanie") {
    if (needsKey) return redirectTo("/logowanie/klucz");
    return redirectTo(homePathForRole(role));
  }

  if (pathname === "/logowanie/klucz" || pathname.startsWith("/logowanie/klucz/")) {
    if (!staffNeedsAal2(role)) {
      return redirectTo(homePathForRole(role));
    }
    if (!needsKey) {
      return redirectTo(homePathForRole(role));
    }
    return supabaseResponse;
  }

  if (pathname.startsWith("/placowka")) {
    if (!isStaffRole(role)) {
      return redirectTo(homePathForRole(role));
    }
    if (needsKey) {
      return redirectTo("/logowanie/klucz");
    }
    return supabaseResponse;
  }

  if (pathname.startsWith("/rodzina")) {
    if (role !== "family") {
      return redirectTo(homePathForRole(role));
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
