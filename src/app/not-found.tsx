import Link from 'next/link';

export default function NotFound() {
  return <main className="not-found"><h1>Nothing here</h1><p>This channel or video could not be found.</p><Link href="/">Go home</Link></main>;
}

