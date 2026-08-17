import type { IEmailProvider } from "../../domain/ports/email-provider.port";
import type { INotificationLogRepository } from "../../domain/ports/notification-log-repository.port";
import { SendEmailUseCase, SendEmailInput } from "./send-email.use-case";

describe("SendEmailUseCase", () => {
  let emailProvider: jest.Mocked<IEmailProvider>;
  let notificationLog: jest.Mocked<INotificationLogRepository>;
  let useCase: SendEmailUseCase;

  beforeEach(() => {
    emailProvider = { send: jest.fn().mockResolvedValue(undefined) };
    notificationLog = {
      hasBeenSent: jest.fn().mockResolvedValue(false),
      record: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new SendEmailUseCase(emailProvider, notificationLog);
  });

  const baseInput: SendEmailInput = {
    orderId: "order-uuid-001",
    organizationId: "org-uuid-001",
    eventType: "order.paid.v1",
    recipientEmail: "buyer@example.com",
    subject: "Seu pedido foi confirmado!",
    text: "Olá!\n\nSeu pedido #order-uuid-001 foi confirmado.",
    outboxEventId: "outbox-uuid-001",
  };

  it("sends email and records notification log on first call", async () => {
    await useCase.execute(baseInput);

    expect(emailProvider.send).toHaveBeenCalledWith({
      to: "buyer@example.com",
      subject: "Seu pedido foi confirmado!",
      text: "Olá!\n\nSeu pedido #order-uuid-001 foi confirmado.",
    });

    expect(notificationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-uuid-001",
        orderId: "order-uuid-001",
        eventType: "order.paid.v1",
        recipientEmail: "buyer@example.com",
        outboxEventId: "outbox-uuid-001",
      }),
    );
  });

  it("does not re-send email when notification log shows it was already sent (idempotency)", async () => {
    notificationLog.hasBeenSent.mockResolvedValue(true);

    await useCase.execute(baseInput);

    expect(emailProvider.send).not.toHaveBeenCalled();
    expect(notificationLog.record).not.toHaveBeenCalled();
  });

  it("sends email and records log when orderId is absent (no idempotency check)", async () => {
    const inputWithoutOrderId: SendEmailInput = {
      organizationId: "org-uuid-001",
      eventType: "order.paid.v1",
      recipientEmail: "buyer@example.com",
      subject: "Seu pedido foi confirmado!",
      text: "Olá!\n\nSeu pedido foi confirmado.",
      outboxEventId: "outbox-uuid-001",
    };

    await useCase.execute(inputWithoutOrderId);

    expect(notificationLog.hasBeenSent).not.toHaveBeenCalled();
    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(notificationLog.record).toHaveBeenCalledTimes(1);
  });
});
