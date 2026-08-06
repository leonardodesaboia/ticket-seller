export interface IssueLink {
  label: string;
  href: string;
}

/**
 * Maps a backend readiness `section` to the backoffice page that resolves it.
 * The backend owns the rules and messages; this only provides navigation. An
 * unknown section falls back to the configuration page so a newly added code is
 * still actionable rather than a dead end.
 */
export function sectionLink(
  section: string,
  organizationId: string,
  eventId: string,
): IssueLink | null {
  const base = `/organizations/${organizationId}/events/${eventId}`;
  switch (section) {
    case 'organization':
      return null;
    case 'basic':
      return { label: 'Editar título/descrição', href: `${base}/edit` };
    case 'format':
    case 'schedule':
    case 'venue':
    case 'online':
    case 'currency':
    case 'ticketTypes':
      return { label: 'Abrir configuração', href: `${base}/configuration` };
    default:
      return { label: 'Abrir configuração', href: `${base}/configuration` };
  }
}
