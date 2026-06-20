export function SiteFooter() {
  return (
    <footer className="border-t py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© 2026 <a href="https://alaner652.com" className="hover:text-foreground transition-colors">alaner652</a></span>
        <div className="flex gap-4">
          <a href="https://github.com/alaner652" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          <a href="https://github.com/alaner652/AveMujicaBot" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Source</a>
        </div>
      </div>
    </footer>
  );
}
