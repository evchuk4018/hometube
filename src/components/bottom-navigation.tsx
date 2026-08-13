'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNavigation() {
  const pathname = usePathname();
  const channelsActive = pathname.includes('/channels');
  const homeActive = !channelsActive && !pathname.includes('/watch/');
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <Link href="/" aria-current={homeActive ? 'page' : undefined} className={homeActive ? 'active' : ''}>
        <HomeIcon /><span>Home</span>
      </Link>
      <Link href="/channels" aria-current={channelsActive ? 'page' : undefined} className={channelsActive ? 'active' : ''}>
        <ChannelsIcon /><span>Channels</span>
      </Link>
    </nav>
  );
}

function ChannelsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M3 19c0-3 2.2-5 5-5s5 2 5 5M13 15.5c1-.8 2.1-1.2 3.5-1.2 2.5 0 4.5 1.7 4.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
