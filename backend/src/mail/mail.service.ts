import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Transactional e-mail via Resend's HTTP API. Without RESEND_API_KEY nothing is sent:
 * development logs the message (so codes can be tested locally), tests keep it in `outbox`,
 * production logs an error without the content.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Test-only record of messages (NODE_ENV=test). */
  readonly outbox: MailMessage[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Returns true when the provider accepted the message. Never throws. */
  async send(message: MailMessage): Promise<boolean> {
    const env = this.config.get('NODE_ENV', { infer: true });
    if (env === 'test') {
      this.outbox.push(message);
      return true;
    }
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    if (!apiKey) {
      if (env === 'production') {
        this.logger.error('RESEND_API_KEY is not set — e-mail was not sent');
      } else {
        this.logger.warn(
          `[dev mail] to=${message.to} subject="${message.subject}"\n${message.text}`,
        );
      }
      return false;
    }
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.config.get('MAIL_FROM', { infer: true }),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.error(`Resend rejected the message: HTTP ${res.status} ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`E-mail delivery failed: ${String(err)}`);
      return false;
    }
  }
}
