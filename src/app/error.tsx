'use client';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="not-found"><h1>HomeTube hit a snag</h1><p>Try the request again.</p><button className="primary-button" onClick={reset}>Try again</button></main>;
}
