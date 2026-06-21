import { NextRequest, NextResponse } from "next/server";
import { listSeries } from "@/lib/db";
import { validateSeries, searchSubtitles } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const available = listSeries();
  const series = searchParams.get("series") ?? available[0] ?? "";
  const invalid = validateSeries(series);
  if (invalid) return NextResponse.json({ error: invalid.error }, { status: invalid.status });

  const payload = searchSubtitles({
    series,
    keyword: searchParams.get("keyword") ?? "",
    episode: searchParams.get("episode") ?? null,
    page: Math.max(1, Number(searchParams.get("page") ?? 1)),
    limit: Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20))),
  });

  return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=30" } });
}
