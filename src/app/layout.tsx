import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { preconnect } from "react-dom";
import { appPath } from "./app-path";
import { BottomNav } from "./components/bottom-nav";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HomeTube", template: "%s · HomeTube" },
  description: "Private local playback, discovery, and podcast listening.",
  manifest: appPath("/manifest.webmanifest")
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  preconnect("https://i.ytimg.com");

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link className="wordmark" href={appPath("/")} aria-label="HomeTube home">
              <span className="wordmark-mark">▶</span>
              <span>HomeTube</span>
            </Link>
            <span className="private-badge"><span className="private-badge-dot" />Private library</span>
          </header>
          <main className="main-content">{children}</main>
          <footer className="footer">Local-first media · 720p ceiling · rotating cache</footer>
        </div>
        <BottomNav />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
