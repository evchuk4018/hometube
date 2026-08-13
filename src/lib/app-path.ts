export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function appPath(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${basePath}${normalized}`;
}

