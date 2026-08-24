import { NextRequest } from "next/server";
import { getFrameBuffer } from "@/lib/media";
import { mediaResponse } from "@/lib/media-response";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const { series, id: rawId } = await params;
  const id = rawId.replace(/\.(png|jpg|jpeg)$/, "");
  return mediaResponse(() => getFrameBuffer(series, id), "image/jpeg");
}
