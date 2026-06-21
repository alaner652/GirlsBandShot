import { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api-key";
import { getGifBuffer } from "@/lib/media";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const auth = requireApiKey(req, "gif");
  if (!auth.ok) return auth.response;

  const { series, id } = await params;
  const buf = await getGifBuffer(series, id);
  if (!buf) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "public, max-age=3600",
      "X-RateLimit-Remaining": String(auth.remaining),
    },
  });
}
