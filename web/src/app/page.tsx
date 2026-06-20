import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center space-y-6">
        <div className="space-y-3 max-w-xl">
          <h1 className="text-4xl font-bold tracking-tight">雞狗查圖</h1>
          <p className="text-xl text-muted-foreground">Ave Mujica 字幕截圖搜尋</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            輸入一句台詞，找到那個畫面。<br />
            所有截圖與 GIF 皆由原始影片即時生成，無需預存媒體。
          </p>
        </div>

        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
        >
          開始搜尋 →
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full pt-8">
          {[
            { icon: "🔍", title: "關鍵字搜尋", desc: "輸入任意台詞，支援全 13 集" },
            { icon: "🖼️", title: "即時截圖", desc: "ffmpeg 從原始影片截幀，LRU cache 加速" },
            { icon: "🎞️", title: "GIF 生成", desc: "一鍵生成字幕片段動圖" },
          ].map((f) => (
            <div key={f.title} className="border rounded-xl p-4 text-left space-y-1">
              <div className="text-2xl">{f.icon}</div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
