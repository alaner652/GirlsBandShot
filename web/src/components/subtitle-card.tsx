"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card
      className="cursor-pointer hover:ring-2 hover:ring-primary transition-all overflow-hidden group"
      onClick={() => onClick(result)}
    >
      <div className="relative aspect-video bg-muted">
        {!imgLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.image_url}
          alt={result.text}
          className="w-full h-full object-cover"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
        />
        <button
          onClick={handleCopy}
          className="absolute top-1.5 right-1.5 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="複製文字"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm line-clamp-2">{result.text}</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">EP {result.episode_id}</Badge>
          <span className="text-xs text-muted-foreground">{result.timestamp}</span>
        </div>
      </CardContent>
    </Card>
  );
}
