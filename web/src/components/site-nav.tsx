import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="border-b">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold hover:opacity-80 transition-opacity">
          雞狗查圖
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/search" className="hover:text-foreground transition-colors">搜尋</Link>
          <a href="https://github.com/alaner652" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub ↗</a>
          <a href="https://alaner652.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">關於作者 ↗</a>
        </div>
      </div>
    </nav>
  );
}
