import "server-only";

import { mailTransport } from "@ai-ems/config/env";
import { env } from "@ai-ems/config/env.server";
import { logger } from "@ai-ems/observability/logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface SendResult {
  /** False when no transport delivered it — the UI should offer another way (e.g. copy link). */
  delivered: boolean;
}

/**
 * Product email. Development prints messages to the server console; a real
 * provider (SMTP/API) plugs in here in a later phase. Never throws.
 */
export async function sendMail(message: MailMessage): Promise<SendResult> {
  const transport = mailTransport(env());
  if (transport === "log") {
    // Development only (see mailTransport): the body may contain a one-time link.
    console.warn(`\n✉  To: ${message.to}\n   Subject: ${message.subject}\n\n${message.text}\n`);
    return { delivered: true };
  }
  logger.info("mail.not_sent", { reason: "no_transport", subject: message.subject });
  return { delivered: false };
}
