import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDesktopRuntime } from "./lib/runtime-mode";

const webAuthMiddleware = withAuth({
  pages: {
    signIn: "/login",
  },
});

export default function middleware(request: NextRequest) {
  if (isDesktopRuntime()) {
    return NextResponse.next();
  }

  return webAuthMiddleware(request as Parameters<typeof webAuthMiddleware>[0], {} as never);
}

export const config = {
  matcher: ["/admin/:path*", "/backup/:path*", "/api/admin/:path*"],
};
