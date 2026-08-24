import { NextRequest } from "next/server";
import { getGifBuffer } from "@/lib/media";
import { mediaResponse } from "@/lib/media-response";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const { series, id: rawId } = await params;
  const id = rawId.replace(/\.gif$/, "");
  return mediaResponse(() => getGifBuffer(series, id), "image/gif");
}
