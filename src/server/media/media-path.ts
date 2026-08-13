import path from 'node:path';

export function mediaRoot(): string {
  const configured = process.env.HOMETUBE_MEDIA_ROOT ?? path.join(process.cwd(), 'data', 'media');
  return path.resolve(/* turbopackIgnore: true */ configured);
}

export function resolveMediaPath(relativePath: string, root = mediaRoot()): string {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error('Invalid media path');
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Media path escapes the configured root');
  return resolved;
}
