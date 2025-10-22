import type { Metadata } from "next";
import { Suspense } from "react";
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
  title: "SFU Course Finder",
  description: "Browse SFU course offerings by various attributes and build your schedule.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-yellow-200 focus:px-3 focus:py-2 focus:text-black">Skip to main content</a>
        <header className="sticky top-0 z-10 border-b border-black/10 dark:border-white/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-red-600"></span>
              <span className="text-sm font-semibold tracking-tight">SFU Course Finder</span>
            </div>
            <a className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200" href="https://www.sfu.ca/students/calendar/" target="_blank" rel="noreferrer">
              Academic Calendar →
            </a>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6">
          <Suspense fallback={<div className="text-sm text-zinc-600">Loading…</div>}>
            {children}
          </Suspense>
        </main>
      </body>
    </html>
  );
}
