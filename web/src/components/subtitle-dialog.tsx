"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ClipboardCopy, Download } from "lucide-react";
import { useState } from "react";
import type { SubtitleResult } from "@/components/subtitle-card";

interface Props {
  result: SubtitleResult | null;
  onClose: () => void;
}

export function SubtitleDialog({ result, onClose }: Props) {
  const [showGif, setShowGif] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const duration =
    result.end_seconds != null
      ? `${(result.end_seconds - result.seconds).toFixed(1)}s`
      : "—";

  async function handleCopyImage() {
    if (copying) return;
    setCopying(true);
    try {
      const res = await fetch(result!.image_url);
      const blob = await res.blob();
      const pngBlob = blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: copy URL
      await navigator.clipboard.writeText(window.location.origin + result!.image_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } finally {
      setCopying(false);
    }
  }

  function handleDownloadGif() {
    const a = document.createElement("a");
    a.href = result!.gif_url;
    a.download = `${result!.id}.gif`;
    a.click();
  }

  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) {
          setShowGif(false);
          setGifLoaded(false);
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge>EP {result.episode_id}</Badge>
            <span>{result.timestamp}</span>
            <span className="text-muted-foreground text-sm font-normal">({duration})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
            {showGif ? (
              <>
                {!gifLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.gif_url}
                  alt={result.text}
                  className="w-full h-full object-contain"
                  onLoad={() => setGifLoaded(true)}
                />
              </>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={result.image_url}
                alt={result.text}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <p className="text-lg">{result.text}</p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              信心度 {(result.confidence * 100).toFixed(0)}%
            </span>

            <div className="flex items-center gap-2">
              {!showGif ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyImage}
                  disabled={copying}
                  className="gap-1.5"
                >
                  {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  {copied ? "已複製" : copying ? "複製中..." : "複製截圖"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadGif}
                  className="gap-1.5"
                >
                  <Download size={14} />
                  下載 GIF
                </Button>
              )}

              <Button
                variant={showGif ? "secondary" : "default"}
                size="sm"
                onClick={() => {
                  setShowGif((v) => !v);
                  setGifLoaded(false);
                  setCopied(false);
                }}
              >
                {showGif ? "看截圖" : "看 GIF"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
