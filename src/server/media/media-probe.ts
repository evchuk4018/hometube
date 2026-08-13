import { runProcess } from '@/server/youtube/process-runner';

export type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
};

export type ProbeResult = {
  streams?: ProbeStream[];
  format?: { format_name?: string };
};

export async function probeMedia(filePath: string): Promise<ProbeResult> {
  const result = await runProcess(process.env.FFPROBE_COMMAND ?? 'ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', filePath
  ]);
  return JSON.parse(result.stdout) as ProbeResult;
}

export function mediaCodecs(result: ProbeResult): {
  video: ProbeStream | undefined;
  audio: ProbeStream | undefined;
} {
  return {
    video: result.streams?.find((stream) => stream.codec_type === 'video'),
    audio: result.streams?.find((stream) => stream.codec_type === 'audio')
  };
}
