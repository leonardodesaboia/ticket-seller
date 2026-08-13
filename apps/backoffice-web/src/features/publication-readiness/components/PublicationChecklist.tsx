import Link from 'next/link';
import type { PublicationReadiness } from '../types';
import { sectionLink } from '../lib/issue-catalog';

interface PublicationChecklistProps {
  readiness: PublicationReadiness;
  organizationId: string;
  eventId: string;
}

export function PublicationChecklist({
  readiness,
  organizationId,
  eventId,
}: PublicationChecklistProps) {
  if (readiness.ready) {
    return (
      <p className="rounded-md border border-input bg-secondary p-3 text-sm text-secondary-foreground">
        Tudo pronto para publicar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Pendências antes de publicar</h3>
      <ul className="flex flex-col gap-2">
        {readiness.issues.map((issue) => {
          const link = sectionLink(issue.section, organizationId, eventId);
          return (
            <li
              key={`${issue.code}:${issue.field}`}
              className="flex items-start justify-between gap-3 rounded-md border border-input p-3 text-sm"
            >
              <span className="text-foreground">{issue.message}</span>
              {link && (
                <Link
                  href={link.href}
                  className="whitespace-nowrap text-primary underline underline-offset-4 hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {link.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
