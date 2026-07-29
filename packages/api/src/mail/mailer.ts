/** What an invited person is sent: their address, and the link that identifies their invitation. */
export interface InvitationMessage {
  readonly to: string;
  readonly link: string;
}

/**
 * The system's one outbound side effect. Kept to a single method so the shape
 * has little room to be wrong when a real transport arrives — the slice that
 * brings a mail catcher and a provider is the one with a screen to exercise it.
 */
export interface Mailer {
  send(message: InvitationMessage): Promise<void>;
}

/**
 * The only implementation there is for now: it keeps what it was asked to send
 * in memory. Nothing in this system can yet reach a real mail server, and that
 * is deliberate — `npm run dev` and the whole test suite stay offline, matching
 * the project's zero-external-services posture.
 *
 * A spec reads `sent` to get the link the way its recipient would.
 */
export class InMemoryMailer implements Mailer {
  readonly sent: InvitationMessage[] = [];

  async send(message: InvitationMessage): Promise<void> {
    this.sent.push(message);
  }
}
