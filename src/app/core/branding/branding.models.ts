export interface PlatformBranding {
  id?: string;
  key?: string;
  appName: string;
  tagline: string;
  accentColor: string;
  accentStrongColor: string;
  brandColor: string;
  logoUrl: string;
  faviconUrl: string;
}

export const DEFAULT_BRANDING: PlatformBranding = {
  appName: 'قطع غيار',
  tagline: 'منصة الجملة لقطع غيار الموبايل',
  accentColor: '#10b880',
  accentStrongColor: '#0d9a6a',
  brandColor: '#0f172a',
  logoUrl: '',
  faviconUrl: '',
};
