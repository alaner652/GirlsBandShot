import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const BASE = "https://girls-band.alaner652.com";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground text-sm px-1.5 py-0.5 rounded font-mono break-all">
      {children}
    </code>
  );
}

function Block({ children }: { children: string }) {
  return (
    <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre leading-relaxed">
      {children.trim()}
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-20">
      <h2 className="text-xl font-bold border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children, color = "default" }: { children: string; color?: "orange" | "default" }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
      color === "orange" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" : "bg-muted text-muted-foreground"
    }`}>
      {children}
    </span>
  );
}

type Param = { name: string; in: "query" | "path" | "header"; type: string; required: boolean; desc: string; default?: string };

function Endpoint({
  method, path, desc, params, responseDesc, response,
}: {
  method: string;
  path: string;
  desc: string;
  params?: Param[];
  responseDesc?: string;
  response: string;
}) {
  const pathParams = params?.filter(p => p.in === "path") ?? [];
  const queryParams = params?.filter(p => p.in === "query") ?? [];

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/40">
        <span className="font-mono text-xs font-bold bg-foreground text-background px-2 py-0.5 rounded shrink-0">
          {method}
        </span>
        <code className="font-mono text-sm">{path}</code>
        <span className="text-muted-foreground text-sm ml-auto hidden sm:block">{desc}</span>
      </div>

      {pathParams.length > 0 && (
        <ParamTable title="路徑參數" params={pathParams} />
      )}
      {queryParams.length > 0 && (
        <ParamTable title="Query 參數" params={queryParams} />
      )}

      <div className="px-4 py-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          回傳{responseDesc ? ` — ${responseDesc}` : ""}
        </p>
        <Block>{response}</Block>
      </div>
    </div>
  );
}

function ParamTable({ title, params }: { title: string; params: Param[] }) {
  return (
    <div className="px-4 py-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs">
            <th className="pb-1.5 font-medium w-40">名稱</th>
            <th className="pb-1.5 font-medium w-16">型別</th>
            <th className="pb-1.5 font-medium w-16">必填</th>
            <th className="pb-1.5 font-medium">說明</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="py-2 font-mono text-xs">
                {p.name}
                {p.default !== undefined && (
                  <span className="ml-1 text-muted-foreground">= {p.default}</span>
                )}
              </td>
              <td className="py-2 text-muted-foreground text-xs">{p.type}</td>
              <td className="py-2 text-xs">
                {p.required
                  ? <Badge color="orange">必填</Badge>
                  : <span className="text-muted-foreground text-xs">選填</span>}
              </td>
              <td className="py-2 text-muted-foreground text-xs">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />

      <div className="max-w-5xl mx-auto w-full px-6 py-12 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-24 space-y-0.5 text-sm">
            {[
              ["#quickstart", "快速開始"],
              ["#auth", "認證"],
              ["#errors", "錯誤碼"],
              ["#rate-limits", "速率限制"],
              ["#endpoints", "Endpoints"],
              ["#examples", "範例"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="block text-muted-foreground hover:text-foreground transition-colors py-1.5 border-l-2 border-transparent hover:border-foreground pl-3"
              >
                {label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 space-y-12 min-w-0">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">雞狗查圖 API</h1>
            <p className="text-muted-foreground leading-relaxed">
              以關鍵字搜尋 Ave Mujica 字幕，並取得對應的截圖（PNG）或動圖（GIF）。
              截圖與 GIF 皆由伺服器從原始影片即時生成，不預存任何媒體檔案。
            </p>
            <p className="text-sm">
              Base URL：<Code>{BASE}</Code>
            </p>
          </div>

          {/* Quick start */}
          <Section id="quickstart" title="快速開始">
            <p className="text-sm text-muted-foreground">典型使用流程分三步：</p>
            <ol className="space-y-3">
              {[
                {
                  step: "1",
                  title: "搜尋字幕",
                  desc: <>呼叫 <Code>GET /api/v1/search?keyword=你的台詞</Code>，取回符合的字幕列表。</>,
                },
                {
                  step: "2",
                  title: "從結果拿 URL",
                  desc: <>每筆結果都有 <Code>image_url</Code> 和 <Code>gif_url</Code>，路徑已完整，直接拼 Base URL 即可使用。</>,
                },
                {
                  step: "3",
                  title: "請求媒體",
                  desc: <>用 <Code>GET {BASE}{"<image_url>"}</Code> 取得 PNG 截圖，或用 <Code>gif_url</Code> 取得 GIF。都需要帶 <Code>X-Api-Key</Code>。</>,
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                    {item.step}
                  </span>
                  <div className="space-y-0.5 pt-0.5">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* Auth */}
          <Section id="auth" title="認證">
            <p className="text-sm text-muted-foreground">
              所有 <Code>/api/v1/*</Code> 請求都需要在 Header 帶入 API Key：
            </p>
            <Block>{"X-Api-Key: your-api-key"}</Block>
            <div className="border rounded-lg p-4 bg-muted/30 space-y-1">
              <p className="text-sm font-medium">如何取得 API Key？</p>
              <p className="text-sm text-muted-foreground">
                請透過{" "}
                <a href="https://github.com/alaner652" className="underline underline-offset-2 hover:text-foreground" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>{" "}
                或{" "}
                <a href="https://alaner652.com" className="underline underline-offset-2 hover:text-foreground" target="_blank" rel="noopener noreferrer">
                  個人網站
                </a>{" "}
                聯繫作者。
              </p>
            </div>
          </Section>

          {/* Errors */}
          <Section id="errors" title="錯誤碼">
            <p className="text-sm text-muted-foreground">
              所有錯誤回傳 JSON，格式為 <Code>{`{ "error": "訊息" }`}</Code>。
            </p>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium w-28">HTTP 狀態</th>
                  <th className="px-4 py-2.5 font-medium">原因</th>
                  <th className="px-4 py-2.5 font-medium">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["401", "Unauthorized", "未提供 X-Api-Key，或 Key 無效。"],
                  ["404", "Not Found", "指定的 series 或字幕 id 不存在。"],
                  ["429", "Too Many Requests", "超過速率限制。Header 含 Retry-After（秒）與 X-RateLimit-Remaining。"],
                ].map(([code, name, desc]) => (
                  <tr key={code}>
                    <td className="px-4 py-2.5 font-mono text-xs">{code}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{name}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Rate limits */}
          <Section id="rate-limits" title="速率限制">
            <p className="text-sm text-muted-foreground">
              <Code>/api/v1/*</Code> 限制依 API Key 計算，每小時重置：
            </p>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Endpoint</th>
                  <th className="px-4 py-2.5 font-medium">限制</th>
                  <th className="px-4 py-2.5 font-medium">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["/api/v1/search", "600 次 / 小時", "搜尋為主要操作，額度較寬。"],
                  ["/api/v1/image/{series}/{id}", "100 次 / 小時", "截圖由 ffmpeg 即時生成，有計算成本。"],
                  ["/api/v1/gif/{series}/{id}", "10 次 / 小時", "GIF 生成耗時，限制最嚴。"],
                ].map(([path, limit, note]) => (
                  <tr key={path as string}>
                    <td className="px-4 py-2.5 font-mono text-xs">{path}</td>
                    <td className="px-4 py-2.5 text-sm font-medium">{limit}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-muted-foreground">
              超過限制時回傳 <Code>429</Code>，並附帶 <Code>Retry-After: 3600</Code>（秒）與 <Code>X-RateLimit-Remaining: 0</Code>。
              快取命中的回應附帶 <Code>X-Cache: HIT</Code>，不計入額度。
            </p>
          </Section>

          {/* Endpoints */}
          <Section id="endpoints" title="Endpoints">
            <div className="space-y-8">
              <Endpoint
                method="GET"
                path="/api/v1/series"
                desc="列出所有可搜尋的系列"
                responseDesc="可用系列陣列"
                response={`{
  "series": ["ave-mujica"]
}`}
              />

              <Endpoint
                method="GET"
                path="/api/v1/search"
                desc="搜尋字幕"
                params={[
                  { name: "keyword", in: "query", type: "string", required: false, desc: "搜尋關鍵字。留空則回傳全部字幕（配合 episode 篩選用）。" },
                  { name: "series", in: "query", type: "string", required: false, desc: "系列名稱，如 ave-mujica。省略時使用第一個可用系列。" },
                  { name: "episode", in: "query", type: "string", required: false, desc: "篩選特定集數，如 01、13。省略時搜尋全部集數。" },
                  { name: "page", in: "query", type: "number", required: false, default: "1", desc: "頁碼，從 1 開始。" },
                  { name: "limit", in: "query", type: "number", required: false, default: "20", desc: "每頁筆數，最大 50。" },
                ]}
                responseDesc="分頁結果"
                response={`{
  "total": 4419,       // 符合條件的總筆數
  "page": 1,
  "limit": 20,
  "results": [
    {
      "id": "ep_01_frame_000511",     // 字幕唯一 ID
      "episode_id": "01",             // 集數
      "timestamp": "00:00:21",        // 字幕起始時間（HH:MM:SS）
      "seconds": 21.0,                // 起始秒數（浮點）
      "end_seconds": 24.0,            // 結束秒數（GIF 使用此區間）
      "text": "來吧，甦醒之夜到來了",
      "confidence": 0.98,             // OCR 信心度，0–1，越高越準確
      "image_url": "/api/v1/image/ave-mujica/ep_01_frame_000511",
      "gif_url":   "/api/v1/gif/ave-mujica/ep_01_frame_000511"
    }
  ]
}`}
              />

              <Endpoint
                method="GET"
                path="/api/v1/image/{series}/{id}"
                desc="取得字幕截圖（PNG）"
                params={[
                  { name: "series", in: "path", type: "string", required: true, desc: "系列名稱，如 ave-mujica。" },
                  { name: "id", in: "path", type: "string", required: true, desc: "字幕 ID，從 search 結果的 id 欄位取得。" },
                ]}
                responseDesc="截圖為 seconds 時間點的影片幀，1920×1080 PNG"
                response={`HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=86400

<binary PNG>`}
              />

              <Endpoint
                method="GET"
                path="/api/v1/gif/{series}/{id}"
                desc="取得字幕動圖（GIF）"
                params={[
                  { name: "series", in: "path", type: "string", required: true, desc: "系列名稱，如 ave-mujica。" },
                  { name: "id", in: "path", type: "string", required: true, desc: "字幕 ID，從 search 結果的 id 欄位取得。" },
                ]}
                responseDesc={`GIF 範圍為 seconds → end_seconds（若無 end_seconds 則補 +3 秒），640px 寬，10 fps`}
                response={`HTTP/1.1 200 OK
Content-Type: image/gif
Cache-Control: public, max-age=86400

<binary GIF>`}
              />
            </div>
          </Section>

          {/* Examples */}
          <Section id="examples" title="範例">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2">curl — 搜尋後下載截圖</p>
                <Block>{`# 1. 搜尋「甦醒」
curl "${BASE}/api/v1/search?keyword=甦醒&series=ave-mujica" \\
  -H "X-Api-Key: your-key"

# 2. 拿到 image_url 後下載截圖
curl "${BASE}/api/v1/image/ave-mujica/ep_01_frame_000511" \\
  -H "X-Api-Key: your-key" -o shot.png

# 3. 或下載 GIF
curl "${BASE}/api/v1/gif/ave-mujica/ep_01_frame_000511" \\
  -H "X-Api-Key: your-key" -o clip.gif`}</Block>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Python — 搜尋並儲存所有截圖</p>
                <Block>{`import requests

BASE = "${BASE}"
HEADERS = {"X-Api-Key": "your-key"}

res = requests.get(
    f"{BASE}/api/v1/search",
    headers=HEADERS,
    params={"keyword": "甦醒", "series": "ave-mujica", "limit": 5},
)
data = res.json()
print(f"共 {data['total']} 筆，顯示前 {len(data['results'])} 筆")

for r in data["results"]:
    print(f"  EP{r['episode_id']} {r['timestamp']}  {r['text']}")

    # 下載截圖
    img = requests.get(BASE + r["image_url"], headers=HEADERS)
    with open(f"{r['id']}.png", "wb") as f:
        f.write(img.content)`}</Block>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">JavaScript / TypeScript — Discord Bot 範例</p>
                <Block>{`const BASE = "${BASE}";
const KEY = process.env.JIGOU_API_KEY!;
const headers = { "X-Api-Key": KEY };

async function searchSubtitle(keyword: string) {
  const url = new URL("/api/v1/search", BASE);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("series", "ave-mujica");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(\`search failed: \${res.status}\`);

  const { results } = await res.json();
  if (!results.length) return null;

  const hit = results[0];
  // image_url 和 gif_url 直接拼 BASE 即可
  return {
    text: hit.text,
    episode: hit.episode_id,
    timestamp: hit.timestamp,
    imageUrl: BASE + hit.image_url,
    gifUrl: BASE + hit.gif_url,
  };
}`}</Block>
              </div>
            </div>
          </Section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
