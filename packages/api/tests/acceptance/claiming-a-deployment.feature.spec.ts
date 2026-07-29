import { fileURLToPath } from 'node:url';
import type { LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, type TestApp } from '../support/test-server.js';
import { tokenFromLink } from '../support/invitations.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./claiming-a-deployment.feature', import.meta.url)),
);

const OPERATOR = 'operator@example.com';
const SOMEONE_ELSE = 'someone-else@example.com';
const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** A deployment whose administrator has been named in configuration, and which nobody has claimed. */
function unclaimedDeployment(configuredFor = OPERATOR): TestApp {
  return makeTestApp(undefined, { ADMIN_BOOTSTRAP_EMAIL: configuredFor });
}

function claim(test: TestApp, email: string): Promise<LightMyRequestResponse> {
  return test.app.inject({ method: 'POST', url: '/setup/admin', payload: { email } });
}

function askIfUnclaimed(test: TestApp): Promise<LightMyRequestResponse> {
  return test.app.inject({ method: 'GET', url: '/setup/admin' });
}

function accept(test: TestApp, token: string): Promise<LightMyRequestResponse> {
  return test.app.inject({
    method: 'POST',
    url: `/invites/${token}/accept`,
    payload: { password: STRONG_PASSWORD },
  });
}

/** The token from the most recent message — how the operator gets theirs. */
function newestToken(test: TestApp): string {
  return tokenFromLink(test.mailer.sent.at(-1)!.link);
}

/** Claims the deployment and accepts, leaving an administrator signed in. */
async function claimAndAccept(test: TestApp): Promise<{ cookie: string; accepted: LightMyRequestResponse }> {
  await claim(test, OPERATOR);
  const accepted = await accept(test, newestToken(test));
  const signedIn = await test.app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: OPERATOR, password: STRONG_PASSWORD },
  });
  const access = signedIn.cookies.find((cookie) => cookie.name === 'access_token');
  return { cookie: `access_token=${access?.value ?? ''}`, accepted };
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A claim whose message cannot be sent still stands', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given(
      'a deployment configured for "operator@example.com" whose mail server will take nothing',
      () => {
        test = unclaimedDeployment();
        test.mailer.failEverySend();
      },
    );
    When('"operator@example.com" claims it', async () => {
      response = await claim(test, OPERATOR);
    });
    Then('claiming is not refused', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().messageSent).toBe(false);
    });
    And('the link is offered in that answer', () => {
      expect(response.json().link).toMatch(/^https?:\/\/.+\/.+$/);
    });
    And('accepting with that link makes the administrator', async () => {
      const link: string = response.json().link;
      const accepted = await accept(test, link.slice(link.lastIndexOf('/') + 1));
      expect(accepted.statusCode).toBe(201);
      const row = test.db
        .prepare('SELECT role FROM host_accounts WHERE email = ?')
        .get(OPERATOR) as { role: string } | undefined;
      expect(row?.role).toBe('admin');
    });
  });

  Scenario('An unclaimed deployment says so', ({ Given, When, Then }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('anyone asks whether it is unclaimed', async () => {
      response = await askIfUnclaimed(test);
    });
    Then('it reports that it is', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().unclaimed).toBe(true);
    });
  });

  Scenario('The configured address claims the deployment', ({ Given, When, Then }) => {
    let test: TestApp;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"operator@example.com" claims it', async () => {
      const claimed = await claim(test, OPERATOR);
      expect(claimed.statusCode).toBe(201);
    });
    Then('an invitation is sent to "operator@example.com"', () => {
      expect(test.mailer.sent).toHaveLength(1);
      expect(test.mailer.sent[0]!.to).toBe(OPERATOR);
    });
  });

  Scenario('Another address cannot claim the deployment', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"someone-else@example.com" tries to claim it', async () => {
      response = await claim(test, SOMEONE_ELSE);
    });
    Then('claiming is refused', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('CLAIM_REFUSED');
    });
    And('no message is sent to "someone-else@example.com"', () => {
      expect(test.mailer.sent).toHaveLength(0);
    });
  });

  Scenario('A refused claim does not reveal the configured address', ({ Given, When, Then }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"someone-else@example.com" tries to claim it', async () => {
      response = await claim(test, SOMEONE_ELSE);
    });
    Then('the refusal does not name "operator@example.com"', () => {
      expect(response.body).not.toContain(OPERATOR);
    });
  });

  Scenario('The person who claimed the deployment becomes its administrator', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let cookie: string;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"operator@example.com" claims it and accepts with a strong password', async () => {
      ({ cookie } = await claimAndAccept(test));
    });
    Then('an administrator account exists for "operator@example.com"', () => {
      const row = test.db
        .prepare('SELECT role FROM host_accounts WHERE email = ?')
        .get(OPERATOR) as { role: string } | undefined;
      expect(row?.role).toBe('admin');
    });
    And('that administrator can do administrative work', async () => {
      const listed = await test.app.inject({
        method: 'GET',
        url: '/admin/hosts',
        headers: { cookie },
      });
      expect(listed.statusCode).toBe(200);
    });
  });

  Scenario('Claiming does not sign anybody in by itself', ({ Given, When, Then }) => {
    let test: TestApp;
    let accepted: LightMyRequestResponse;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"operator@example.com" claims it and accepts with a strong password', async () => {
      ({ accepted } = await claimAndAccept(test));
    });
    Then('no session is granted by the acceptance itself', () => {
      expect(accepted.statusCode).toBe(201);
      expect(accepted.cookies).toHaveLength(0);
    });
  });

  Scenario('Claiming again sends a fresh link and kills the earlier one', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let firstToken: string;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"operator@example.com" claims it twice', async () => {
      await claim(test, OPERATOR);
      firstToken = newestToken(test);
      const again = await claim(test, OPERATOR);
      expect(again.statusCode).toBe(201);
    });
    Then('another message is sent to "operator@example.com"', () => {
      expect(test.mailer.sent).toHaveLength(2);
      expect(test.mailer.sent[1]!.to).toBe(OPERATOR);
    });
    And('it carries a different link', () => {
      expect(test.mailer.sent[1]!.link).not.toBe(test.mailer.sent[0]!.link);
    });
    And('accepting with the earlier link is refused', async () => {
      const refused = await accept(test, firstToken);
      expect(refused.statusCode).toBe(404);
      expect(refused.json().error.code).toBe('INVITATION_UNUSABLE');
    });
  });

  Scenario('A claimed deployment says so', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"operator@example.com" claims it and accepts with a strong password', async () => {
      await claimAndAccept(test);
    });
    And('anyone asks whether it is unclaimed', async () => {
      response = await askIfUnclaimed(test);
    });
    Then('it reports that it is not', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().unclaimed).toBe(false);
    });
  });

  Scenario('The configured address cannot claim a deployment twice', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = unclaimedDeployment();
    });
    When('"operator@example.com" claims it and accepts with a strong password', async () => {
      await claimAndAccept(test);
    });
    And('"operator@example.com" tries to claim it again', async () => {
      response = await claim(test, OPERATOR);
    });
    Then('claiming is refused because the deployment is already claimed', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('SETUP_COMPLETE');
    });
  });
});
