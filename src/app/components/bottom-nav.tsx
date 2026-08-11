"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { appPath } from "../app-path";

type IconName = "home" | "search" | "podcast" | "close" | "arrow";

function Icon({ name }: { name: IconName }) {
  if (name === "home") {
    return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none"><path d="m3.5 10.8 8.5-7 8.5 7v8.7a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-8.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9.2 20.8v-6.1h5.6v6.1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
  }

  if (name === "search") {
    return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.9" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
  }

  if (name === "podcast") {
    return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none"><path d="M8.1 17.8a8.2 8.2 0 1 1 7.8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M10.5 14.8a3.8 3.8 0 1 1 3 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M12 12v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="9" r="1.3" fill="currentColor" /></svg>;
  }

  if (name === "close") {
    return <svg aria-hidden="true" className="sheet-icon" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
  }

  return <svg aria-hidden="true" className="choice-arrow" viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const homePath = appPath("/");
  const podcastsPath = appPath("/podcasts");
  const isHome = pathname === homePath;
  const isPodcasts = pathname.startsWith(podcastsPath);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function closeSheet() {
    setIsOpen(false);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    closeSheet();
    router.push(appPath(`/channels?q=${encodeURIComponent(trimmedQuery)}`));
  }

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <Link className={`bottom-nav-item ${isHome ? "active" : ""}`} href={homePath} aria-current={isHome ? "page" : undefined}>
          <Icon name="home" />
          <span>Home</span>
        </Link>
        <button className={`bottom-nav-item bottom-nav-search ${isOpen ? "active" : ""}`} type="button" onClick={() => setIsOpen(true)} aria-expanded={isOpen} aria-controls="channel-search-sheet">
          <Icon name="search" />
          <span>Search</span>
        </button>
        <Link className={`bottom-nav-item ${isPodcasts ? "active" : ""}`} href={podcastsPath} aria-current={isPodcasts ? "page" : undefined}>
          <Icon name="podcast" />
          <span>Podcasts</span>
        </Link>
      </nav>

      {isOpen ? (
        <div className="search-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSheet(); }}>
          <section className="search-sheet" id="channel-search-sheet" role="dialog" aria-modal="true" aria-labelledby="channel-search-title">
            <div className="search-sheet-heading">
              <div>
                <p className="kicker">Find something to follow</p>
                <h2 id="channel-search-title">Search HomeTube</h2>
              </div>
              <button className="sheet-close" type="button" onClick={closeSheet} aria-label="Close search"><Icon name="close" /></button>
            </div>
            <div className="search-choice-list">
              <Link className="search-choice" href={appPath("/channels")} onClick={closeSheet}>
                <span className="search-choice-icon"><Icon name="podcast" /></span>
                <span><strong>Channels</strong><small>Browse your catalog and add a source to the feed.</small></span>
                <Icon name="arrow" />
              </Link>
              <form className="search-sheet-form" onSubmit={submitSearch}>
                <label className="search-sheet-field">
                  <span className="sr-only">Search channels</span>
                  <Icon name="search" />
                  <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels" autoComplete="off" />
                </label>
                <button className="button button-primary search-submit" type="submit" disabled={!query.trim()}><Icon name="search" /><span>Search</span></button>
              </form>
            </div>
            <p className="search-sheet-hint">Search finds channels already in your local catalog. Add a new YouTube handle from the Channels page.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
