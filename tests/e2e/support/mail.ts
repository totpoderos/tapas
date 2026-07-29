import { expect, request as playwrightRequest } from '@playwright/test';
import { MAILPIT_API } from '../../../playwright.config.js';

interface MailpitSummary {
  readonly ID: string;
  readonly To: { readonly Address: string }[];
}

/**
 * Clears the catcher. A catcher accumulates, so a spec asking for "the newest
 * message" can otherwise get one three specs old. The suite runs single-worker
 * and not in parallel, so clearing before a spec is both safe and cheap.
 */
export async function clearMail(): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: MAILPIT_API });
  await api.delete('/api/v1/messages');
  await api.dispose();
}

/**
 * The invitation link sent to an address, read the way its recipient would read
 * it — out of the message, never out of the database, which holds only a hash.
 *
 * Polls rather than sleeps: the SMTP transaction completes before the catcher
 * finishes indexing, so reading straight after the API's answer can miss. A
 * fixed wait is either flaky on a loaded runner or slow on every run.
 */
export async function invitationLinkSentTo(address: string): Promise<string> {
  const api = await playwrightRequest.newContext({ baseURL: MAILPIT_API });
  try {
    let link: string | undefined;

    await expect
      .poll(
        async () => {
          const listed = await api.get('/api/v1/messages');
          const messages: MailpitSummary[] = (await listed.json()).messages ?? [];
          const match = messages.find((message) =>
            message.To.some((recipient) => recipient.Address === address),
          );
          if (!match) return undefined;

          const body = await (await api.get(`/api/v1/message/${match.ID}`)).json();
          link = /https?:\/\/\S*\/accept-invite\/\S+/.exec(body.Text ?? '')?.[0];
          return link;
        },
        { timeout: 10_000, message: `no invitation message reached ${address}` },
      )
      .toBeTruthy();

    return link!;
  } finally {
    await api.dispose();
  }
}
