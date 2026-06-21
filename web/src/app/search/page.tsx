"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SubtitleCard, SubtitleResult } from "@/components/subtitle-card";
import { SubtitleDialog } from "@/components/subtitle-dialog";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

const LIMIT = 24;
const EPISODES = ["01","02","03","04","05","06","07","08","09","10","11","12","13"];

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
      {Array.from({ length: LIMIT }).map((_, i) => (
        <Skeleton key={i} className="aspect-video w-full rounded-lg" />
      ))}
    </div>
  );
}


function NoResults({ keyword }: { keyword: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center space-y-1">
      <p className="text-muted-foreground">
        找不到「{keyword}」的結果
      </p>
      <p className="text-sm text-muted-foreground/60">試試不同的關鍵字</p>
    </div>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [seriesList, setSeriesList] = useState<string[]>([]);
  const [keyword, setKeyword] = useState(() => searchParams.get("keyword") ?? "");
  const [series, setSeries] = useState(() => searchParams.get("series") ?? "");
  const [episode, setEpisode] = useState(() => searchParams.get("episode") ?? "");
  const [results, setResults] = useState<SubtitleResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SubtitleResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    fetch("/api/series")
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = data.series ?? [];
        setSeriesList(list);
        if (!series && list.length > 0) setSeries(list[0]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPage = useCallback(async (kw: string, s: string, ep: string, p: number) => {
    if (!s) return;
    setLoading(true);
    const params = new URLSearchParams({ keyword: kw, series: s, page: String(p), limit: String(LIMIT) });
    if (ep) params.set("episode", ep);
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setTotal(data.total ?? 0);
    setPage(p);
    setSearched(true);
    setLoading(false);
  }, []);

  // Initial fetch when series resolves
  useEffect(() => {
    if (!series) return;
    fetchPage(searchParams.get("keyword") ?? "", series, searchParams.get("episode") ?? "", 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  function handleKeywordChange(value: string) {
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value) params.set("keyword", value);
      if (series) params.set("series", series);
      if (episode) params.set("episode", episode);
      router.replace(`/search?${params}`, { scroll: false });
      fetchPage(value, series, episode, 1);
    }, 400);
  }

  function handleEpisodeChange(ep: string) {
    setEpisode(ep);
    fetchPage(keyword, series, ep, 1);
  }

  function handleSeriesChange(s: string) {
    setSeries(s);
    fetchPage(keyword, s, episode, 1);
  }

  function handlePage(p: number) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    fetchPage(keyword, series, episode, p);
  }

  function openResult(r: SubtitleResult) {
    setSelected(r);
    const p = new URLSearchParams(window.location.search);
    p.set("id", r.id);
    router.replace(`/search?${p}`, { scroll: false });
  }

  function closeResult() {
    setSelected(null);
    const p = new URLSearchParams(window.location.search);
    p.delete("id");
    router.replace(`/search?${p}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-5">

        {/* Search controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="搜尋台詞..."
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            className="sm:max-w-xs"
            autoFocus
          />
          <div className="flex gap-2">
            {seriesList.length > 1 && (
              <select
                value={series}
                onChange={(e) => handleSeriesChange(e.target.value)}
                className="flex-1 sm:flex-none border rounded-md px-3 text-sm bg-background h-9 min-w-0"
              >
                {seriesList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <select
              value={episode}
              onChange={(e) => handleEpisodeChange(e.target.value)}
              className="flex-1 sm:flex-none border rounded-md px-3 text-sm bg-background h-9 min-w-0"
            >
              <option value="">全部集數</option>
              {EPISODES.map((ep) => (
                <option key={ep} value={ep}>EP {ep}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        {!loading && total > 0 && (
          <p className="text-sm text-muted-foreground">
            {total} 筆{keyword ? `「${keyword}」` : ""}結果
            {totalPages > 1 && ` — 第 ${page} / ${totalPages} 頁`}
          </p>
        )}

        {/* States */}
        {loading && <SkeletonGrid />}

        {!loading && searched && results.length === 0 && <NoResults keyword={keyword} />}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 animate-in fade-in duration-200">
            {results.map((r) => (
              <SubtitleCard key={r.id} result={r} onClick={openResult} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1}
            >
              ← 上一頁
            </Button>
            <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages}
            >
              下一頁 →
            </Button>
          </div>
        )}
      </div>

      <SiteFooter />
      <SubtitleDialog result={selected} onClose={closeResult} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
