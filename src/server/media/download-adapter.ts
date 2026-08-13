import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { extractBackgroundAudio, type BackgroundAudio } from './background-audio';
import { mediaCodecs, probeMedia } from './media-probe';
import { resolveMediaPath } from './media-path';
import { runProcess } from '@/server/youtube/process-runner';

export type DownloadedMedia = {
  relativePath: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  backgroundAudio: BackgroundAudio | null;
};

export function buildDownloadArgs(videoId: string, outputTemplate: string): string[] {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) throw new Error('Invalid YouTube video ID');
  return [
    '--ignore-config', '--js-runtimes', 'node:/usr/local/bin/node',
    '--no-playlist', '--newline', '--no-warnings', '--no-call-home',
    '--format', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]',
    '--format-sort', 'res:720,vcodec:h264,acodec:aac,ext:mp4:m4a',
    '--merge-output-format', 'mp4', '--output', outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`
  ];
}

export function parseDownloadProgress(line: string): number | null {
  const match = /\[download\]\s+([\d.]+)%/.exec(line);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

export async function downloadVideo(
  jobId: string,
  videoId: string,
  onProgress: (progress: number, stage: string) => Promise<void>
): Promise<DownloadedMedia> {
  const root = resolveMediaPath('.', undefined);
  const incomingRelative = path.join('.incoming', jobId);
  const incoming = resolveMediaPath(incomingRelative, root);
  const outputTemplate = path.join(incoming, 'source.%(ext)s');
  const stagingPath = resolveMediaPath(`videos/.${videoId}.${jobId}.part`, root);
  const audioStagingPath = resolveMediaPath(`videos/.${videoId}.${jobId}.audio.part.m4a`, root);
  await mkdir(incoming, { recursive: true });

  try {
    await runProcess(process.env.YTDLP_COMMAND ?? 'yt-dlp', buildDownloadArgs(videoId, outputTemplate), {
      onStdoutLine: async (line) => {
        const progress = parseDownloadProgress(line);
        if (progress !== null) await onProgress(progress * 0.88, 'Downloading');
      },
      onStderrLine: async (line) => {
        const progress = parseDownloadProgress(line);
        if (progress !== null) await onProgress(progress * 0.88, 'Downloading');
      }
    });

    const candidates = (await readdir(incoming)).filter((name) => !name.endsWith('.part') && !name.endsWith('.ytdl'));
    const sourceName = candidates.find((name) => name.startsWith('source.'));
    if (!sourceName) throw new Error('The downloader did not produce a media file.');
    const source = path.join(incoming, sourceName);
    const initialProbe = await probeMedia(source);
    const initial = mediaCodecs(initialProbe);
    if (!initial.video) throw new Error('The downloaded file does not contain video.');
    if ((initial.video.height ?? 0) > 720) throw new Error('The downloaded video exceeds the 720p limit.');

    await onProgress(90, 'Preparing for iPhone playback');
    const relativePath = `videos/${videoId}.mp4`;
    const finalPath = resolveMediaPath(relativePath, root);
    await mkdir(path.dirname(finalPath), { recursive: true });

    const directlyCompatible = initial.video.codec_name === 'h264' && (!initial.audio || initial.audio.codec_name === 'aac');
    const ffmpegArgs = ['-nostdin', '-y', '-i', source, '-map', '0:v:0', '-map', '0:a:0?'];
    if (directlyCompatible) {
      ffmpegArgs.push('-c', 'copy');
    } else {
      ffmpegArgs.push(
        '-vf', "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'
      );
    }
    ffmpegArgs.push('-movflags', '+faststart', '-f', 'mp4', stagingPath);
    await runProcess(process.env.FFMPEG_COMMAND ?? 'ffmpeg', ffmpegArgs);

    const finalProbe = await probeMedia(stagingPath);
    const final = mediaCodecs(finalProbe);
    if (!final.video || final.video.codec_name !== 'h264' || (final.video.height ?? 0) > 720) {
      throw new Error('The prepared media failed compatibility validation.');
    }
    if (final.audio && final.audio.codec_name !== 'aac') throw new Error('The prepared audio is not AAC.');

    let backgroundAudio: BackgroundAudio | null = null;
    if (final.audio) {
      await onProgress(96, 'Preparing background audio');
      const audioRelativePath = `videos/${videoId}.m4a`;
      const audioSizeBytes = await extractBackgroundAudio(stagingPath, audioStagingPath);
      await rename(audioStagingPath, resolveMediaPath(audioRelativePath, root));
      backgroundAudio = {
        relativePath: audioRelativePath,
        sizeBytes: audioSizeBytes,
        contentType: 'audio/mp4'
      };
    }

    await rename(stagingPath, finalPath);
    const fileStat = await stat(finalPath);
    return {
      relativePath: relativePath.replaceAll('\\', '/'),
      sizeBytes: fileStat.size,
      width: final.video.width ?? null,
      height: final.video.height ?? null,
      videoCodec: final.video.codec_name ?? null,
      audioCodec: final.audio?.codec_name ?? null,
      backgroundAudio
    };
  } finally {
    await rm(incoming, { recursive: true, force: true }).catch(() => undefined);
    await rm(stagingPath, { force: true }).catch(() => undefined);
    await rm(audioStagingPath, { force: true }).catch(() => undefined);
  }
}
