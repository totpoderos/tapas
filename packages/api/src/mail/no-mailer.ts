import type { InvitationMessage, Mailer } from './mailer.js';

/**
 * The transport for a deployment that has no mail server, and says so.
 *
 * Nothing about the system needs one. An invitation is stored before it is
 * sent, and `InviteHost` answers a failed send with the link itself so the
 * administrator can hand it over — the screen already shows it, and there is a
 * column recording that it went out by hand. Mail is a convenience over that
 * path, not the path.
 *
 * So this refuses at once rather than pretending to send. Two things follow,
 * and both are why this exists instead of simply pointing `MAIL_HOST` at
 * nothing:
 *
 * - **No waiting.** An unreachable SMTP host makes every invitation sit through
 *   a TCP timeout first. Refusing immediately keeps the answer instant.
 * - **No lie in the logs.** A deployment that chose to send no mail and one
 *   whose mail server is broken look identical in a log full of connection
 *   errors, and they are not the same thing — the first is working as intended.
 */
export class NoMailer implements Mailer {
  async send(_message: InvitationMessage): Promise<void> {
    throw new Error('this deployment sends no mail — hand the invitation link over instead');
  }
}
