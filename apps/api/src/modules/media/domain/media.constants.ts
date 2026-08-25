export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 3600;
