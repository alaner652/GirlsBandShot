import { NextRequest } from "next/server";
import { getFrameBuffer } from "@/lib/media";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ series: string; id: string }> }
) {
  const { series, id: rawId } = await params;
  const id = rawId.replace(/\.(png|jpg|jpeg)$/, "");
  const buf = await getFrameBuffer(series, id);
  if (!buf) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
