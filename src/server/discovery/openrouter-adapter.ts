import { z } from 'zod';

const candidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().url(),
  reason: z.string().trim().min(1).max(500)
});

const recommendationsSchema = z.object({
  channels: z.array(candidateSchema).min(1).max(10)
});

type DiscoveryContext = { name: string; handle: string | null; sourceUrl: string };
export type ChannelCandidate = z.infer<typeof candidateSchema>;

const responseJsonSchema = {
  name: 'youtube_channel_recommendations',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      channels: {
        type: 'array', minItems: 1, maxItems: 10,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            url: { type: 'string', description: 'Canonical public youtube.com channel URL, preferably https://www.youtube.com/@handle' },
            reason: { type: 'string' }
          },
          required: ['name', 'url', 'reason'], additionalProperties: false
        }
      }
    },
    required: ['channels'], additionalProperties: false
  }
} as const;

export async function recommendChannels(
  context: DiscoveryContext[],
  excludedUrls: string[],
  count: number
): Promise<{ candidates: ChannelCandidate[]; model: string }> {
  const apiKey = normalizeEnvironmentSecret(process.env.OPENROUTER_API_KEY);
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for channel discovery.');
  const model = process.env.OPENROUTER_DISCOVERY_MODEL ?? 'openrouter/auto';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': 'https://homelab.tail861ffd.ts.net/hometube',
      'x-title': 'HomeTube'
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          `Recommend ${count} real public YouTube channels this viewer is likely to enjoy.`,
          'Use the viewer channels as taste context. Return channels, not videos. Prefer precise canonical channel URLs.',
          `Viewer channels: ${JSON.stringify(context)}`,
          `Never return these previously evaluated channels: ${JSON.stringify(excludedUrls)}`
        ].join('\n')
      }],
      plugins: [{ id: 'web', max_results: 8 }],
      provider: { require_parameters: true },
      response_format: { type: 'json_schema', json_schema: responseJsonSchema },
      temperature: 0.4
    }),
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok) {
    const message = (await response.text()).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 500);
    throw new Error(`OpenRouter discovery failed (${response.status}): ${message}`);
  }
  const body = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string | Array<{ type: string; text?: string }> } }>;
  };
  const raw = body.choices?.[0]?.message?.content;
  const content = typeof raw === 'string'
    ? raw
    : raw?.map((part) => part.text ?? '').join('') ?? '';
  const parsed = recommendationsSchema.parse(JSON.parse(content));
  return { candidates: parsed.channels, model: body.model ?? model };
}

export function normalizeEnvironmentSecret(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length >= 2 && (
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))
  )) return trimmed.slice(1, -1).trim();
  return trimmed;
}

export function deduplicateCandidates(candidates: ChannelCandidate[], excludedUrls: string[]): ChannelCandidate[] {
  const seen = new Set(excludedUrls.map((url) => url.toLowerCase()));
  return candidates.filter((candidate) => {
    const key = candidate.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
