import { createTransport, type Transporter } from 'nodemailer';
import type { InvitationMessage, Mailer } from './mailer.js';

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly from: string;
  /** Whether the connection is TLS from the first byte. A local catcher speaks plain SMTP. */
  readonly secure: boolean;
}

/**
 * The transport everything outside the API process uses — development, the
 * demo, the end-to-end run and production. Deliberately the same in all four:
 * a transport exercised only by the test suite, sitting beside a different one
 * exercised only by production, is the asymmetry this codebase keeps paying
 * for.
 *
 * SMTP rather than a provider's HTTP API, so a deployment can point at any mail
 * server — and so the demo runs this code against a local catcher rather than
 * standing in for something the audience never sees.
 *
 * This throws when no mail server will take the message. That is the contract
 * `InviteHost` guards: the invitation is already stored, and a failure here is
 * reported rather than propagated.
 */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      // A local catcher wants no credentials; a real relay always has them.
      auth: settings.user ? { user: settings.user, pass: settings.password } : undefined,
    });
  }

  async send(message: InvitationMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.settings.from,
      to: message.to,
      subject: 'Set up your Tapas host account',
      text: [
        'You have been invited to host on Tapas.',
        '',
        'Open this link to choose a password and finish setting up your account:',
        message.link,
        '',
        'The link works once, and only for 24 hours.',
      ].join('\n'),
    });
  }
}
