import { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api-key";
import { getGifBuffer } from "@/lib/media";
import { mediaResponse } from "@/lib/media-response";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const auth = requireApiKey(req, "gif");
  if (!auth.ok) return auth.response;

  const { series, id: rawId } = await params;
  const id = rawId.replace(/\.gif$/, "");
  return mediaResponse(() => getGifBuffer(series, id), "image/gif", {
    "X-RateLimit-Remaining": String(auth.remaining),
  });
}
