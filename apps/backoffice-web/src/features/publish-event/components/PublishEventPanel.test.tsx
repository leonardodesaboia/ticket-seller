import { render, screen, fireEvent } from '@testing-library/react';
import { PublishEventPanel } from './PublishEventPanel';
import { PublishError } from '../api/publish.api';

jest.mock('@/features/publication-readiness', () => ({
  ...jest.requireActual('@/features/publication-readiness'),
  usePublicationReadiness: jest.fn(),
}));

jest.mock('../hooks/use-publish-event', () => ({
  usePublishEvent: jest.fn(),
}));

import { usePublicationReadiness } from '@/features/publication-readiness';
import { usePublishEvent } from '../hooks/use-publish-event';

const mockReadiness = usePublicationReadiness as jest.Mock;
const mockPublish = usePublishEvent as jest.Mock;

const PROPS = {
  organizationId: 'org-1',
  eventId: 'evt-1',
  version: 3,
  devUserId: 'user-1',
};

function makeQuery(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, error: null, ...overrides };
}

function makeMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: jest.fn(), isPending: false, isError: false, error: null, ...overrides };
}

const READY_DATA = { ready: true, version: 3, issues: [] };
const NOT_READY_DATA = {
  ready: false,
  version: 3,
  issues: [
    { code: 'EVENT_TITLE_REQUIRED', field: 'title', section: 'basic', message: 'Defina o título.' },
  ],
};

describe('PublishEventPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading indicator while readiness is being fetched', () => {
    mockReadiness.mockReturnValue(makeQuery({ isLoading: true }));
    mockPublish.mockReturnValue(makeMutation());

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando checklist...');
  });

  it('shows an error when the readiness query fails', () => {
    mockReadiness.mockReturnValue(makeQuery({ error: new Error('falha de rede') }));
    mockPublish.mockReturnValue(makeMutation());

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('alert')).toHaveTextContent('falha de rede');
  });

  it('disables the publish button and shows a hint when the event is not ready', () => {
    mockReadiness.mockReturnValue(makeQuery({ data: NOT_READY_DATA }));
    mockPublish.mockReturnValue(makeMutation());

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('button', { name: 'Publicar evento' })).toBeDisabled();
    expect(screen.getByText(/Resolva as pendências/)).toBeInTheDocument();
  });

  it('enables the publish button when the event is ready', () => {
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation());

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('button', { name: 'Publicar evento' })).toBeEnabled();
  });

  it('shows confirmation buttons after clicking "Publicar evento"', () => {
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation());

    render(<PublishEventPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));

    expect(screen.getByRole('button', { name: 'Confirmar publicação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('returns to the initial state when cancel is clicked', () => {
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation());

    render(<PublishEventPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Publicar evento' })).toBeInTheDocument();
  });

  it('calls mutate with the event version when confirmed', () => {
    const mutate = jest.fn();
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ mutate }));

    render(<PublishEventPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ version: PROPS.version });
  });

  it('uses the same idempotency key when confirmed twice without changing payload', () => {
    const mutate = jest.fn();
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ mutate }));

    render(<PublishEventPanel {...PROPS} />);

    // First attempt
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    // Cancel and retry — the component is still in confirming state (mutate is mocked, onSuccess never fires)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const firstKey = mutate.mock.calls[0][0].idempotencyKey;
    const secondKey = mutate.mock.calls[1][0].idempotencyKey;
    expect(firstKey).toBe(secondKey);
  });

  it('disables confirm and cancel buttons while mutation is pending', () => {
    const mutate = jest.fn();
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ mutate }));

    const { rerender } = render(<PublishEventPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));

    // Simulate mutation transitioning to pending state
    mockPublish.mockReturnValue(makeMutation({ mutate, isPending: true }));
    rerender(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('button', { name: 'Publicando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  it('shows a conflict message for a 409 error', () => {
    const error = new PublishError(409, 'Conflito de versão.', 'VERSION_CONFLICT', null, null);
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ isError: true, error }));

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Conflito de versão. Atualize a página e tente novamente.',
    );
  });

  it('shows a not-ready message for a 422 error', () => {
    const error = new PublishError(422, 'Evento não pronto', 'READINESS_FAILED', null, []);
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ isError: true, error }));

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O evento não está pronto para publicação.',
    );
  });

  it('shows a generic network error message for unknown errors', () => {
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ isError: true, error: new Error('Network error') }));

    render(<PublishEventPanel {...PROPS} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível publicar o evento. Verifique sua conexão',
    );
  });

  it('dismisses the confirm dialog on mutation error so error and buttons are not shown simultaneously', () => {
    // mutate immediately calls onError to simulate a failed request
    const mutate = jest.fn().mockImplementation((_payload: unknown, options?: { onError?: () => void }) => {
      options?.onError?.();
    });
    const error = new PublishError(409, 'Conflito de versão.', 'VERSION_CONFLICT', null, null);
    mockReadiness.mockReturnValue(makeQuery({ data: READY_DATA }));
    mockPublish.mockReturnValue(makeMutation({ mutate, isError: true, error }));

    render(<PublishEventPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    // onError reset confirming — dialog is gone, error alert is visible, initial button is back
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar evento' })).toBeInTheDocument();
  });
});
