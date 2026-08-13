import { render, screen } from '@testing-library/react';
import { PublicationChecklist } from './PublicationChecklist';
import type { PublicationReadiness } from '../types';

const org = 'org-1';
const evt = 'evt-1';

describe('PublicationChecklist', () => {
  it('shows a ready message when there are no issues', () => {
    const readiness: PublicationReadiness = { ready: true, version: 4, issues: [] };
    render(<PublicationChecklist readiness={readiness} organizationId={org} eventId={evt} />);

    expect(screen.getByText(/Tudo pronto para publicar/)).toBeInTheDocument();
  });

  it('renders each issue message with a link to the relevant section', () => {
    const readiness: PublicationReadiness = {
      ready: false,
      version: 4,
      issues: [
        { code: 'EVENT_TITLE_REQUIRED', field: 'title', section: 'basic', message: 'Defina o título.' },
        {
          code: 'EVENT_STARTS_AT_REQUIRED',
          field: 'startsAt',
          section: 'schedule',
          message: 'Defina o início.',
        },
      ],
    };
    render(<PublicationChecklist readiness={readiness} organizationId={org} eventId={evt} />);

    expect(screen.getByText('Defina o título.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar título/descrição' })).toHaveAttribute(
      'href',
      `/organizations/${org}/events/${evt}/edit`,
    );
    expect(screen.getAllByRole('link', { name: 'Abrir configuração' })[0]).toHaveAttribute(
      'href',
      `/organizations/${org}/events/${evt}/configuration`,
    );
  });

  it('falls back to a generic configuration link for an unknown section', () => {
    const readiness: PublicationReadiness = {
      ready: false,
      version: 4,
      issues: [
        { code: 'SOME_FUTURE_CODE', field: 'x', section: 'brand-new', message: 'Nova pendência.' },
      ],
    };
    render(<PublicationChecklist readiness={readiness} organizationId={org} eventId={evt} />);

    expect(screen.getByText('Nova pendência.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir configuração' })).toHaveAttribute(
      'href',
      `/organizations/${org}/events/${evt}/configuration`,
    );
  });
});
