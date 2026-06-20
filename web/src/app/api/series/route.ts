import { listSeries } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const series = listSeries();
  return Response.json({ series });
}
