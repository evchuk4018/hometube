import { stat } from 'node:fs/promises';
import { mediaCodecs, probeMedia } from './media-probe';
import { runProcess } from '@/server/youtube/process-runner';

export type BackgroundAudio = {
  relativePath: string;
  sizeBytes: number;
  contentType: 'audio/mp4';
};

export function buildBackgroundAudioArgs(sourcePath: string, outputPath: string): string[] {
  return [
    '-nostdin', '-y', '-i', sourcePath,
    '-map', '0:a:0', '-vn', '-c:a', 'copy',
    '-movflags', '+faststart', '-f', 'mp4', outputPath
  ];
}

export async function extractBackgroundAudio(sourcePath: string, outputPath: string): Promise<number> {
  await runProcess(
    process.env.FFMPEG_COMMAND ?? 'ffmpeg',
    buildBackgroundAudioArgs(sourcePath, outputPath)
  );
  const streams = mediaCodecs(await probeMedia(outputPath));
  if (!streams.audio || streams.audio.codec_name !== 'aac' || streams.video) {
    throw new Error('The prepared background audio failed compatibility validation.');
  }
  return (await stat(outputPath)).size;
}
