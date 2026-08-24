import { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api-key";
import { getFrameBuffer } from "@/lib/media";
import { mediaResponse } from "@/lib/media-response";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const auth = requireApiKey(req, "image");
  if (!auth.ok) return auth.response;

  const { series, id } = await params;
  return mediaResponse(() => getFrameBuffer(series, id), "image/jpeg", {
    "X-RateLimit-Remaining": String(auth.remaining),
  });
}
