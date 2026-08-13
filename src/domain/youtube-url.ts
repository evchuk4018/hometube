const CHANNEL_PREFIXES = new Set(['channel', 'c', 'user']);

export class InvalidChannelUrlError extends Error {
  constructor(message = 'Enter a public YouTube channel URL.') {
    super(message);
    this.name = 'InvalidChannelUrlError';
  }
}

export function normalizeYouTubeChannelUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidChannelUrlError();

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new InvalidChannelUrlError();
  }

  const hostname = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new InvalidChannelUrlError();
  if (hostname !== 'youtube.com') throw new InvalidChannelUrlError('Only youtube.com channel URLs are supported.');

  const segments = url.pathname.split('/').filter(Boolean);
  const first = segments[0] ?? '';
  let path: string;
  if (first.startsWith('@') && first.length > 1) {
    path = `/${first}`;
  } else if (CHANNEL_PREFIXES.has(first) && segments[1]) {
    path = `/${first}/${segments[1]}`;
  } else {
    throw new InvalidChannelUrlError('Use a channel URL such as youtube.com/@handle.');
  }

  return `https://www.youtube.com${path}`;
}

export function channelLabelFromUrl(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? 'YouTube channel');
}

export function channelCatalogUrls(sourceUrl: string): string[] {
  const base = normalizeYouTubeChannelUrl(sourceUrl);
  return [`${base}/videos`, `${base}/shorts`, `${base}/streams`];
}

