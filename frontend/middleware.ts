import { NextResponse } from "next/server";

/**
 * Dock/yard management is outside the active project scope.
 *
 * Block the dormant route tree before page rendering so direct requests also
 * receive a real HTTP 404 rather than only being hidden from navigation.
 */
export function middleware() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: ["/admin/dock-management/:path*"],
};
