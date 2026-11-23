import { NextResponse, type NextRequest } from "next/server";
import { allowAttempt } from "@/lib/rate-limit";
import { requestSource } from "@/lib/request-source";

// Cover Server Actions as well as JSON endpoints. OAuth GET callbacks can also
// create/link accounts. Authorization and stricter domain limits stay in place.
// No path matcher: moving a form must not silently remove its write limit.
export async function proxy(request: NextRequest) {
  const callback = request.nextUrl.pathname.startsWith("/api/auth/callback/");
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) && !callback)
    return NextResponse.next();
  const headers = { "Cache-Control": "no-store", "Retry-After": "60" };
  try {
    if (
      await allowAttempt(
        "http-write",
        requestSource(request.headers),
        120,
        undefined,
        60,
      )
    )
      return NextResponse.next();
    return NextResponse.json(
      { error: "Too many requests. Wait a minute, then try again." },
      { status: 429, headers },
    );
  } catch {
    // A broken limiter must not silently permit unlimited writes or log secrets.
    return NextResponse.json(
      {
        error: "Changes are temporarily unavailable. Please try again shortly.",
      },
      { status: 503, headers },
    );
  }
}
