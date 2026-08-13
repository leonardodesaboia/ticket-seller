const FORMAT_LABELS: Record<string, string> = {
  IN_PERSON: 'Presencial',
  ONLINE: 'Online',
  HYBRID: 'Híbrido',
};

export function formatEventFormat(format: string | null): string {
  if (!format) return '';
  return FORMAT_LABELS[format] ?? format;
}

/**
 * Formats an ISO timestamp in the event's own timezone (pt-BR locale), falling
 * back to the runtime zone if the timezone is missing or invalid.
 */
export function formatDateTime(iso: string | null, timezone: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
  }
}
