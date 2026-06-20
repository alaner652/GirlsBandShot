import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "雞狗查圖 — Ave Mujica 字幕截圖搜尋",
    template: "%s | 雞狗查圖",
  },
  description: "搜尋 Ave Mujica 動畫字幕，即時生成截圖與 GIF。輸入一句台詞，找到那個畫面。",
  keywords: ["Ave Mujica", "字幕", "截圖", "GIF", "BanG Dream", "搜尋"],
  authors: [{ name: "alaner652", url: "https://alaner652.com" }],
  creator: "alaner652",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "雞狗查圖",
    title: "雞狗查圖 — Ave Mujica 字幕截圖搜尋",
    description: "搜尋 Ave Mujica 動畫字幕，即時生成截圖與 GIF。",
  },
  twitter: {
    card: "summary_large_image",
    title: "雞狗查圖 — Ave Mujica 字幕截圖搜尋",
    description: "搜尋 Ave Mujica 動畫字幕，即時生成截圖與 GIF。",
    creator: "@alaner652",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
