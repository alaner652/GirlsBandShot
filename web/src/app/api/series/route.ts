import { listSeriesMeta } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const series = listSeriesMeta();
  return Response.json({ series });
}
