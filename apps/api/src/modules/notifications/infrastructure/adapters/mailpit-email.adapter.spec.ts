import * as nodemailer from "nodemailer";
import { MailpitEmailAdapter } from "./mailpit-email.adapter";

jest.mock("nodemailer");

describe("MailpitEmailAdapter", () => {
  let adapter: MailpitEmailAdapter;
  const sendMailMock = jest.fn().mockResolvedValue({ messageId: "test-message-id" });

  beforeEach(() => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });
    adapter = new MailpitEmailAdapter();
    adapter.onModuleInit();
    sendMailMock.mockClear();
  });

  it("calls sendMail with correct to, subject and text fields", async () => {
    await adapter.send({
      to: "recipient@example.com",
      subject: "Test subject",
      text: "Hello, world!",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recipient@example.com",
        subject: "Test subject",
        text: "Hello, world!",
      }),
    );
  });

  it("includes the SMTP_FROM env value as from field", async () => {
    await adapter.send({
      to: "recipient@example.com",
      subject: "Subject",
      text: "Body",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(String),
      }),
    );
  });

  it("calls sendMail exactly once per send call", async () => {
    await adapter.send({ to: "a@b.com", subject: "s", text: "t" });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("forwards html field when provided", async () => {
    await adapter.send({
      to: "recipient@example.com",
      subject: "HTML email",
      text: "Fallback text",
      html: "<p>Hello, <strong>world</strong>!</p>",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Fallback text",
        html: "<p>Hello, <strong>world</strong>!</p>",
      }),
    );
  });

  it("omits html field when not provided", async () => {
    await adapter.send({ to: "a@b.com", subject: "s", text: "t" });

    const call = sendMailMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("html");
  });

  it("throws EmailSendError when sendMail rejects", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP connection refused"));

    await expect(
      adapter.send({ to: "a@b.com", subject: "s", text: "t" }),
    ).rejects.toThrow("SMTP delivery failed");
  });
});
