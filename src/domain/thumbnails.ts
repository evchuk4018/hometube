const approvedYouTubeThumbnailHosts = new Set(["i.ytimg.com", "yt3.ggpht.com", "yt3.googleusercontent.com"]);
const youtubeVideoIdPattern = /^[a-zA-Z0-9_-]{11}$/;

export function safeYouTubeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && approvedYouTubeThumbnailHosts.has(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function youtubeThumbnailUrl(providerId: string): string | null {
  return youtubeVideoIdPattern.test(providerId) ? `https://i.ytimg.com/vi/${providerId}/hqdefault.jpg` : null;
}

export function thumbnailUrlForVideo(thumbnailUrl: string | null | undefined, providerId: string): string | null {
  return safeYouTubeThumbnailUrl(thumbnailUrl) ?? youtubeThumbnailUrl(providerId);
}
