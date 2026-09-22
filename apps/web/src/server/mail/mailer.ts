import "server-only";

import { mailSettings } from "@ai-ems/config/env";
import { env } from "@ai-ems/config/env.server";
import { createMailer, type MailMessage, type SendResult } from "@ai-ems/mail/mailer";

export type { MailMessage, SendResult };

/**
 * Product email from the request path (invitations, password links). Shares
 * `packages/mail` with the outbox worker, so both honour the same transport
 * settings. Never throws: callers offer a copyable link when `delivered` is
 * false.
 */
export async function sendMail(message: MailMessage): Promise<SendResult> {
  return createMailer(mailSettings(env())).send(message);
}
