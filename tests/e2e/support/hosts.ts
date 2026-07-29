import { expect, request as playwrightRequest } from '@playwright/test';
import { HOST_APP } from '../../../playwright.config.js';
import { ADMINISTRATOR } from './administrator.js';
import { invitationLinkSentTo } from './mail.js';

/**
 * Gives a host an account the way the system actually does it: the
 * administrator the setup project created invites them, the message arrives,
 * and the link in it is accepted.
 *
 * Every specification that needs a host therefore depends on enrollment
 * working. That is acceptable because the setup project already runs this whole
 * chain to create the administrator, and runs first — so a broken enrollment
 * fails loudly in one place before it can fail confusingly in seventeen.
 *
 * The link is read from the message, never from the database, which holds only
 * a hash of it.
 */
export async function hostInvitedBy(email: string, password: string): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: HOST_APP });
  try {
    await api.post('/auth/login', { data: ADMINISTRATOR });

    const invited = await api.post('/admin/invites', { data: { email } });
    expect(invited.status(), `inviting ${email}`).toBe(201);

    const link = await invitationLinkSentTo(email);
    const accepted = await api.post(`/invites/${link.slice(link.lastIndexOf('/') + 1)}/accept`, {
      data: { password },
    });
    expect(accepted.status(), `accepting for ${email}`).toBe(201);
  } finally {
    await api.dispose();
  }
}
