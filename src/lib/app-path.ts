export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function appPath(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const canonical = normalized.startsWith('/api/') && !normalized.endsWith('/') ? `${normalized}/` : normalized;
  return `${basePath}${canonical}`;
}
