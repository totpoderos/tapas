import { describe, expect, it } from 'vitest';
import { InMemoryMailer } from '../../../src/mail/mailer.js';

describe('InMemoryMailer', () => {
  it('records what it was asked to send, in order', async () => {
    const mailer = new InMemoryMailer();

    await mailer.send({ to: 'one@example.com', link: 'http://localhost/accept-invite/token-1' });
    await mailer.send({ to: 'two@example.com', link: 'http://localhost/accept-invite/token-2' });

    expect(mailer.sent).toEqual([
      { to: 'one@example.com', link: 'http://localhost/accept-invite/token-1' },
      { to: 'two@example.com', link: 'http://localhost/accept-invite/token-2' },
    ]);
  });

  it('has sent nothing before it is used', () => {
    expect(new InMemoryMailer().sent).toEqual([]);
  });
});
