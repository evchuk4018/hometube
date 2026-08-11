"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="empty-state page-empty"><span className="empty-icon">!</span><h1>Library unavailable</h1><p>HomeTube could not load this view. Check the worker and database, then try again.</p><button type="button" className="button button-primary" onClick={() => reset()}>Try again</button></div>;
}

