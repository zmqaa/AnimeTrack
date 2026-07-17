export type RuntimeMode = 'web' | 'desktop';

export function getRuntimeMode(): RuntimeMode {
  return process.env.ANIMETRACK_RUNTIME === 'desktop' ? 'desktop' : 'web';
}

export function isDesktopRuntime(): boolean {
  return getRuntimeMode() === 'desktop';
}

