import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { appPath } from "./app-path";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HomeTube", template: "%s · HomeTube" },
  description: "Private local playback, discovery, and podcast listening.",
  manifest: appPath("/manifest.webmanifest")
};

export const viewport: Viewport = {
  themeColor: "#d5f28a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link className="wordmark" href={appPath("/")} aria-label="HomeTube home">
              <span className="wordmark-mark">▶</span>
              <span>HomeTube</span>
            </Link>
            <nav className="primary-nav" aria-label="Primary navigation">
              <Link href={appPath("/")}>Home</Link>
              <Link href={appPath("/channels")}>Channels</Link>
              <Link href={appPath("/podcasts")}>Podcasts</Link>
            </nav>
            <span className="private-badge">Private library</span>
          </header>
          <main className="main-content">{children}</main>
          <footer className="footer">Local-first media · 720p ceiling · rotating cache</footer>
        </div>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
