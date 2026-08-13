// Keeps the base well under the `events.slug` VarChar(500) column once the
// 37-char `-<uuid>` suffix is appended (max ~237 chars total).
const MAX_SLUG_BASE_LENGTH = 200;
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalizes an event title into a URL-safe slug fragment. Diacritics are
 * stripped, non-alphanumeric runs collapse into single hyphens, and the result
 * is lower-cased and truncated so the final slug stays well within the column
 * limit once the event id is appended.
 */
export function slugifyTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_BASE_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Builds the immutable, globally unique public slug for an event. The full
 * event id guarantees uniqueness even when two events share the same title, and
 * it is preserved verbatim so an empty normalized title still yields a valid
 * slug.
 */
export function buildEventSlug(title: string, eventId: string): string {
  const base = slugifyTitle(title);
  return base.length > 0 ? `${base}-${eventId}` : eventId;
}
