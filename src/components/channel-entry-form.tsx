'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { appPath } from '@/lib/app-path';

export function ChannelEntryForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(appPath('/api/channels'), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url })
      });
      const payload = await response.json() as { channelId?: string; error?: string };
      if (!response.ok || !payload.channelId) throw new Error(payload.error ?? 'Unable to add this channel.');
      router.push(`/channels/${payload.channelId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add this channel.');
      setSubmitting(false);
    }
  }

  return (
    <form className="channel-form" onSubmit={submit}>
      <label htmlFor="channel-url">YouTube channel URL</label>
      <div className="channel-form-row">
        <input
          id="channel-url" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off"
          placeholder="https://youtube.com/@channel" value={url}
          onChange={(event) => setUrl(event.target.value)} required disabled={submitting}
        />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Opening…' : 'Open channel'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
