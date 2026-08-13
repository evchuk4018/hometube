'use client';

import { useState } from 'react';
import { appPath } from '@/lib/app-path';

export function SubscriptionButton({ channelId, initialSubscribed }: { channelId: string; initialSubscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const response = await fetch(appPath(`/api/channels/${channelId}/subscription`), {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscribed: !subscribed })
    });
    if (response.ok) setSubscribed(!subscribed);
    setSaving(false);
  }

  return <button className={subscribed ? 'subscribed-button' : 'subscribe-button'} type="button" onClick={() => void toggle()} disabled={saving}>
    {saving ? 'Saving…' : subscribed ? 'Subscribed' : 'Subscribe'}
  </button>;
}
