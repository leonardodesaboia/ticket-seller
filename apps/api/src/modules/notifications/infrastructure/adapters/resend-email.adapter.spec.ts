import { ResendEmailAdapter } from './resend-email.adapter';

jest.mock('../../../../platform/config/env', () => ({
  env: {
    RESEND_API_KEY: 'test-api-key',
    RESEND_FROM: 'noreply@test.com',
  },
}));

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;

  beforeEach(() => {
    sendMock.mockReset();
    adapter = new ResendEmailAdapter();
  });

  it('sends plain-text email with correct fields', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });

    await adapter.send({
      to: 'buyer@example.com',
      subject: 'Pedido confirmado',
      text: 'Seu ingresso está disponível.',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.com',
        to: 'buyer@example.com',
        subject: 'Pedido confirmado',
        text: 'Seu ingresso está disponível.',
      }),
    );
  });

  it('includes html field when provided', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });

    await adapter.send({
      to: 'buyer@example.com',
      subject: 'Pedido confirmado',
      text: 'Seu ingresso está disponível.',
      html: '<p>Seu ingresso está <strong>disponível</strong>.</p>',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Seu ingresso está disponível.',
        html: '<p>Seu ingresso está <strong>disponível</strong>.</p>',
      }),
    );
  });

  it('omits html field when not provided', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'msg-3' }, error: null });

    await adapter.send({ to: 'a@b.com', subject: 's', text: 't' });

    const call = sendMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('html');
  });

  it('sends exactly once per call', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'msg-4' }, error: null });

    await adapter.send({ to: 'a@b.com', subject: 's', text: 't' });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('throws EmailSendError when Resend rejects', async () => {
    sendMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      adapter.send({ to: 'a@b.com', subject: 's', text: 't' }),
    ).rejects.toThrow('Resend delivery failed');
  });
});
