import { NextRequest, NextResponse } from "next/server";
import { APICallError } from "ai";
import { understandQuery } from "@/lib/query-understanding";
import { searchPlaces } from "@/lib/search";
import { getClientIp, ratelimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

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

  let params;
  try {
    params = await understandQuery(query);
  } catch (err) {
    console.error("understandQuery failed:", err);

    if (APICallError.isInstance(err) && err.statusCode === 429) {
      return NextResponse.json(
        { error: "Gemini's free-tier rate limit was hit for this request — wait a bit and try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to understand the query — the LLM provider returned an error." },
      { status: 502 },
    );
  }

  const outcome = await searchPlaces(params);

  if ("error" in outcome) {
    return NextResponse.json({ query, params, ...outcome }, { status: 404 });
  }

  return NextResponse.json({ query, params, ...outcome });
}
