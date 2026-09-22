import { logger } from "@ai-ems/observability/logger";

import type { Mailer, MailerOptions, MailMessage, SendResult } from "./types";

export type { Mailer, MailMessage, MailerOptions, SendResult } from "./types";

/**
 * Product email with pluggable delivery:
 *   log    — prints the message (development; may contain one-time links)
 *   none   — delivers nothing and says so, so the UI can offer a copyable link
 *   smtp   — any SMTP server, via nodemailer
 *   resend — Resend's HTTP API
 * `send()` never throws; callers decide what to do with `delivered: false`.
 */
export function createMailer(options: MailerOptions): Mailer {
  const { transport, from } = options;
  const write = options.log ?? ((line: string) => console.warn(line));

  async function deliver(message: MailMessage): Promise<SendResult> {
    switch (transport) {
      case "log":
        write(`\n✉  To: ${message.to}\n   Subject: ${message.subject}\n\n${message.text}\n`);
        return { delivered: true, transport };

      case "smtp": {
        if (!options.smtpUrl) throw new Error("SMTP_URL is required for MAIL_TRANSPORT=smtp");
        const { createTransport } = await import("nodemailer");
        const smtp = createTransport(options.smtpUrl);
        const info = await smtp.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        });
        smtp.close();
        return { delivered: true, transport, messageId: info.messageId };
      }

      case "resend": {
        if (!options.resendApiKey)
          throw new Error("RESEND_API_KEY is required for MAIL_TRANSPORT=resend");
        const doFetch = options.fetchImpl ?? fetch;
        const response = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.resendApiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Resend responded ${response.status}: ${(await response.text()).slice(0, 200)}`,
          );
        }
        const body = (await response.json()) as { id?: string };
        return { delivered: true, transport, messageId: body.id };
      }

      case "none":
      default:
        return { delivered: false, transport: "none" };
    }
  }

  return {
    transport,
    async send(message) {
      try {
        const result = await deliver(message);
        if (!result.delivered) {
          logger.info("mail.not_sent", { reason: "no_transport", subject: message.subject });
        }
        return result;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        // Recipients and links stay out of the log line.
        logger.error("mail.send_failed", { transport, subject: message.subject, error: reason });
        return { delivered: false, transport, error: reason };
      }
    },
  };
}
