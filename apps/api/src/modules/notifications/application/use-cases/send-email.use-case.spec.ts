import type { IEmailProvider } from "../../domain/ports/email-provider.port";
import type { INotificationLogRepository } from "../../domain/ports/notification-log-repository.port";
import { SendEmailUseCase, SendEmailInput } from "./send-email.use-case";
import type { ILogger } from "../../../../shared/kernel/logger.port";

const mockLogger: ILogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe("SendEmailUseCase", () => {
  let emailProvider: jest.Mocked<IEmailProvider>;
  let notificationLog: jest.Mocked<INotificationLogRepository>;
  let useCase: SendEmailUseCase;

  beforeEach(() => {
    emailProvider = { send: jest.fn().mockResolvedValue(undefined) };
    notificationLog = {
      hasBeenSent: jest.fn().mockResolvedValue(false),
      hasBeenSentForOutboxEvent: jest.fn().mockResolvedValue(false),
      record: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new SendEmailUseCase(emailProvider, notificationLog, mockLogger);
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

  it("forwards html field to email provider when provided", async () => {
    await useCase.execute({ ...baseInput, html: "<p>Confirmado!</p>" });

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<p>Confirmado!</p>" }),
    );
  });

  it("omits html field from provider call when not provided", async () => {
    await useCase.execute(baseInput);

    const call = (emailProvider.send as jest.Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("html");
  });

  it("skips send when order-level idempotency check returns true", async () => {
    notificationLog.hasBeenSent.mockResolvedValue(true);

    await useCase.execute(baseInput);

    expect(emailProvider.send).not.toHaveBeenCalled();
    expect(notificationLog.record).not.toHaveBeenCalled();
  });

  it("uses outbox-event-level idempotency when orderId is absent", async () => {
    notificationLog.hasBeenSentForOutboxEvent.mockResolvedValue(true);

    const inputWithoutOrderId: SendEmailInput = {
      eventType: "event.cancelled.v1",
      recipientEmail: "admin@example.com",
      subject: "Evento cancelado",
      text: "O evento foi cancelado.",
      outboxEventId: "outbox-uuid-002",
    };

    await useCase.execute(inputWithoutOrderId);

    expect(notificationLog.hasBeenSent).not.toHaveBeenCalled();
    expect(notificationLog.hasBeenSentForOutboxEvent).toHaveBeenCalledWith("outbox-uuid-002");
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it("sends email when outbox-event-level check returns false (no orderId)", async () => {
    const inputWithoutOrderId: SendEmailInput = {
      eventType: "event.cancelled.v1",
      recipientEmail: "admin@example.com",
      subject: "Evento cancelado",
      text: "O evento foi cancelado.",
      outboxEventId: "outbox-uuid-002",
    };

    await useCase.execute(inputWithoutOrderId);

    expect(notificationLog.hasBeenSentForOutboxEvent).toHaveBeenCalledWith("outbox-uuid-002");
    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(notificationLog.record).toHaveBeenCalledTimes(1);
  });

  it("sends without idempotency check when neither orderId nor outboxEventId is provided", async () => {
    const minimalInput: SendEmailInput = {
      eventType: "system.alert.v1",
      recipientEmail: "admin@example.com",
      subject: "Alerta",
      text: "Mensagem de alerta.",
    };

    await useCase.execute(minimalInput);

    expect(notificationLog.hasBeenSent).not.toHaveBeenCalled();
    expect(notificationLog.hasBeenSentForOutboxEvent).not.toHaveBeenCalled();
    expect(emailProvider.send).toHaveBeenCalledTimes(1);
  });
});
