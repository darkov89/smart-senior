import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";

// Edge Middleware (not Next 16 proxy.ts): OpenNext on Cloudflare does not
// support Node.js middleware / proxy runtime.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
