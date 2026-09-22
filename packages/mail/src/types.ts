export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body; transports fall back to `text`. */
  html?: string;
  replyTo?: string;
}

export interface SendResult {
  /** False when no transport delivered it — callers should offer another way (e.g. copy a link). */
  delivered: boolean;
  transport: MailTransportName;
  messageId?: string;
  error?: string;
}

export type MailTransportName = "log" | "none" | "smtp" | "resend";

export interface Mailer {
  readonly transport: MailTransportName;
  send(message: MailMessage): Promise<SendResult>;
}

export interface MailerOptions {
  transport: MailTransportName;
  from: string;
  /** smtp://user:pass@host:587 (or smtps:// for implicit TLS). */
  smtpUrl?: string;
  resendApiKey?: string;
  /** Overridable for tests. */
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}
