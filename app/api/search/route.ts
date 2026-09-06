import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/search";
import { getClientIp, ratelimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim() || null;
  const near = searchParams.get("near")?.trim() || null;
  const radiusParam = searchParams.get("radius");
  const radiusMeters = radiusParam ? Number(radiusParam) : null;

  if (!query) {
    return NextResponse.json({ error: "Missing required query parameter 'q'" }, { status: 400 });
  }

  const { success, reset } = await ratelimit.limit(getClientIp(request));
  if (!success) {
    const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests — please wait a moment before searching again." },
      { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } },
    );
  }

  const outcome = await searchPlaces({ semanticQuery: query, category, near, radiusMeters });

  if ("error" in outcome) {
    return NextResponse.json(outcome, { status: 404 });
  }

  return NextResponse.json({ query, ...outcome });
}
