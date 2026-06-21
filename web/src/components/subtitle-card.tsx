"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export interface SubtitleResult {
  id: string;
  episode_id: string;
  timestamp: string;
  seconds: number;
  end_seconds: number | null;
  text: string;
  confidence: number;
  image_url: string;
  gif_url: string;
}

interface Props {
  result: SubtitleResult;
  onClick: (result: SubtitleResult) => void;
}

export function SubtitleCard({ result, onClick }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(window.location.origin + result.image_url + ".jpg");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="relative aspect-video rounded-lg overflow-hidden cursor-pointer group"
      onClick={() => onClick(result)}
    >
      {!imgLoaded && (
        <div className="absolute inset-0 bg-muted">
          <Skeleton className="absolute inset-0 rounded-none" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={result.image_url}
        alt={result.text}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
      />

      {/* hover overlay — only after image loaded */}
      {imgLoaded && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-2.5">
          <div className="flex justify-between items-start gap-1">
            <span className="text-white text-xs font-mono bg-black/40 rounded px-1.5 py-0.5">
              EP {result.episode_id} · {result.timestamp}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 rounded bg-black/40 text-white shrink-0"
              title="複製圖片 URL"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <p className="text-white text-xs line-clamp-2 leading-relaxed">{result.text}</p>
        </div>
      )}
    </div>
  );
}
