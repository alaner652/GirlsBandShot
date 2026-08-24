import { MediaError } from "@/lib/ffmpeg";

/**
 * 把「取 buffer」包成 HTTP 回應，統一處理錯誤。
 * 沒有這層的話 ffmpeg 一失敗就是裸 500，log 裡什麼都看不到。
 */
export async function mediaResponse(
  load: () => Promise<Buffer | null>,
  contentType: string,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  let buf: Buffer | null;

  try {
    buf = await load();
  } catch (err) {
    if (err instanceof MediaError) {
      console.error(`[media] ${err.message}${err.detail ? `\n        ${err.detail}` : ""}`);
      return Response.json({ error: err.message }, { status: 500 });
    }
    console.error("[media] unexpected error", err);
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  if (!buf) return Response.json({ error: "not found" }, { status: 404 });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      ...extraHeaders,
    },
  });
}
