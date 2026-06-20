import { validateApiKey } from "@/lib/api-key";
import { listSeries } from "@/lib/db";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { valid } = validateApiKey(req);
  if (!valid) {
    return Response.json(
      { error: "Missing or invalid API key", hint: "Provide X-Api-Key header" },
      { status: 401 }
    );
  }
  return Response.json({ series: listSeries() });
}
