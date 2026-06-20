"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubtitleCard, SubtitleResult } from "@/components/subtitle-card";
import { SubtitleDialog } from "@/components/subtitle-dialog";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const EPISODES = ["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"];
const LIMIT = 24;

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
  const [selected, setSelected] = useState<SubtitleResult | null>(null);

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
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!series) return;
    fetchPage(keyword, series, episode, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  function handleSearch() {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (series) params.set("series", series);
    if (episode) params.set("episode", episode);
    router.push(`/search?${params}`, { scroll: false });
    fetchPage(keyword, series, episode, 1);
  }

  function handlePage(p: number) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    fetchPage(keyword, series, episode, p);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex gap-2 flex-wrap">
          {seriesList.length > 1 && (
            <select
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              className="border rounded-md px-3 text-sm bg-background"
            >
              {seriesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <Input
            placeholder="搜尋關鍵字..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <select
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
            className="border rounded-md px-3 text-sm bg-background"
          >
            {EPISODES.map((ep) => (
              <option key={ep} value={ep}>
                {ep ? `EP ${ep}` : "全部集數"}
              </option>
            ))}
          </select>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? "載入中..." : "搜尋"}
          </Button>
        </div>

        {total > 0 && (
          <p className="text-sm text-muted-foreground">
            共 {total} 筆{keyword ? `「${keyword}」` : ""}結果
            {totalPages > 1 && `，第 ${page} / ${totalPages} 頁`}
          </p>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {results.map((r) => (
              <SubtitleCard key={r.id} result={r} onClick={setSelected} />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && keyword.trim() && (
          <p className="text-muted-foreground text-center py-12">沒有找到結果</p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1 || loading}
            >
              ← 上一頁
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              下一頁 →
            </Button>
          </div>
        )}
      </div>
      <SiteFooter />
      <SubtitleDialog result={selected} onClose={() => setSelected(null)} />
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
