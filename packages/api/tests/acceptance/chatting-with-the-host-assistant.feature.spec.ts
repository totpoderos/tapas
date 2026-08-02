import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { LLMClient, LLMCompletion } from '@tapas/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./chatting-with-the-host-assistant.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** An LLM whose next completion the test sets — so we script what the assistant proposes. */
class ScriptedLLMClient implements LLMClient {
  next: LLMCompletion = { text: '', toolCalls: [] };
  async complete(): Promise<LLMCompletion> {
    return this.next;
  }
}

/** A complete, publishable draft: 4 people in 2 couples, per person, couples barred. */
function completeContent(name: string): DraftContent {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    format: 'solo_with_partners',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

class CookieJar {
  private readonly jar = new Map<string, string>();
  capture(response: LightMyRequestResponse): void {
    for (const raw of response.cookies) {
      if (raw.value === '') this.jar.delete(raw.name);
      else this.jar.set(raw.name, raw.value);
    }
  }
  header(): string {
    return [...this.jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

async function request(
  app: FastifyInstance,
  jar: CookieJar,
  options: { method: 'GET' | 'POST'; url: string; payload?: object },
): Promise<LightMyRequestResponse> {
  const response = await app.inject({ ...options, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await seedHost(app, email, STRONG_PASSWORD);
  await request(app, jar, { method: 'POST', url: '/auth/login', payload: { email, password: STRONG_PASSWORD } });
  return jar;
}

/** Publishes a fresh live contest and returns its id. */
async function liveContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<string> {
  const created = await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent(name) });
  const published = await request(app, jar, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  return published.json().id;
}

async function statusOf(app: FastifyInstance, jar: CookieJar, contestId: string): Promise<string> {
  const contest = await request(app, jar, { method: 'GET', url: `/contests/${contestId}` });
  return contest.json().status;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The assistant asks for detail when a request is ambiguous', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('they ask for something the assistant cannot act on without more detail', async () => {
      llm.next = { text: 'Which contest do you mean?', toolCalls: [] };
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Close it.' }] },
      });
    });
    Then('the assistant replies asking them to clarify', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().kind).toBe('reply');
      expect(response.json().text).toMatch(/which contest/i);
    });
    And('nothing about their contest changes', () => {
      // A 'reply' turn ran no tool — there is nothing to have changed.
      expect(response.json().kind).toBe('reply');
    });
  });

  Scenario('The assistant carries out a reversible action and reports it', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('they ask the assistant to start a new draft called "Summer Tapas"', async () => {
      llm.next = {
        text: 'Done — I saved your draft.',
        toolCalls: [{ name: 'create_draft', arguments: { name: 'Summer Tapas' } }],
      };
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Start a draft called Summer Tapas' }] },
      });
    });
    Then('a draft called "Summer Tapas" is saved for them', async () => {
      const drafts = await request(app, jar, { method: 'GET', url: '/drafts' });
      expect(drafts.json().map((d: { content: { name: string } }) => d.content.name)).toContain('Summer Tapas');
    });
    And('the assistant reports that it did so', () => {
      expect(response.json().kind).toBe('result');
      expect(response.json().text).toMatch(/saved your draft/i);
    });
  });

  Scenario('The assistant says what it did in plain language', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('the assistant carries out a reversible action but offers no words of its own', async () => {
      // A small model routinely calls a tool and says nothing at all.
      llm.next = { text: '', toolCalls: [{ name: 'create_draft', arguments: { name: 'Summer Tapas' } }] };
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Start a draft called Summer Tapas' }] },
      });
    });
    Then('the host is still told, in plain language, what was done', () => {
      // The turn names the action that succeeded, so the panel can say so even
      // when the model contributed no sentence of its own.
      expect(response.json().kind).toBe('result');
      expect(response.json().action).toBe('create_draft');
    });
  });

  Scenario('The assistant says when an action could not be carried out', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('an action the assistant tries cannot be carried out', async () => {
      // Publishing a draft that has no scoring rules — the API refuses it.
      await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Bare' },
      });
      llm.next = {
        text: '',
        toolCalls: [{ name: 'publish_contest', arguments: { contest: 'Bare' } }],
      };
      const proposal = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Publish Bare' }] },
      });
      // Publishing is destructive, so it is confirmed before it runs.
      const { action, args, confirmationToken } = proposal.json();
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { confirm: { action, args, confirmationToken } },
      });
    });
    Then('the host is told it did not happen', () => {
      expect(response.json().kind).toBe('failed');
    });
    /*
     * The reason names what the draft still needs, not merely that something is
     * wrong. Asserted on the substance rather than on one word: this used to
     * match /scoring/i, which passed even when the refusal blamed the scoring
     * for a missing format.
     */
    And('the host is told why', () => {
      const { message } = response.json();
      expect(message).toContain('what kind of contest it is');
      expect(message).toContain('who is taking part');
      expect(message).toContain('how it is scored');
    });
  });

  Scenario('A destructive action is not carried out until the host confirms', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host with a running contest, chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, jar, 'Balcony Cook-off');
    });
    When('they ask the assistant to close that contest', async () => {
      llm.next = {
        text: '',
        toolCalls: [{ name: 'close_contest', arguments: { contest: 'Balcony Cook-off' } }],
      };
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Close my contest' }] },
      });
    });
    Then('the contest is not closed', async () => {
      expect(await statusOf(app, jar, contestId)).toBe('live');
    });
    And('the assistant asks the host to confirm closing it', () => {
      expect(response.json().kind).toBe('confirm');
      expect(response.json().action).toBe('close_contest');
      expect(response.json().confirmationToken).toBeTruthy();
    });
  });

  Scenario('Confirming carries out the destructive action', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let contestId: string;
    let confirm: { action: string; args: object; confirmationToken: string };

    Given('a host whom the assistant has asked to confirm closing their running contest', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, jar, 'Balcony Cook-off');
      llm.next = {
        text: '',
        toolCalls: [{ name: 'close_contest', arguments: { contest: 'Balcony Cook-off' } }],
      };
      const asked = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Close my contest' }] },
      });
      const body = asked.json();
      confirm = { action: body.action, args: body.args, confirmationToken: body.confirmationToken };
    });
    When('the host confirms', async () => {
      await request(app, jar, { method: 'POST', url: '/assistant/messages', payload: { confirm } });
    });
    Then('the contest is closed', async () => {
      expect(await statusOf(app, jar, contestId)).toBe('closed');
    });
  });

  Scenario('A confirmation authorises only the action it was given for', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let otherContestId: string;
    let tokenForFirst: string;
    let response: LightMyRequestResponse;

    Given('a host who was asked to confirm closing one running contest', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'First Contest');
      otherContestId = await liveContest(app, jar, 'Second Contest');
      llm.next = {
        text: '',
        toolCalls: [{ name: 'close_contest', arguments: { contest: 'First Contest' } }],
      };
      const asked = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Close the first contest' }] },
      });
      // Keep the token issued for the FIRST contest, to misuse against the second.
      tokenForFirst = asked.json().confirmationToken as string;
    });
    When('that confirmation is used to try to close a different contest', async () => {
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: {
          confirm: {
            action: 'close_contest',
            args: { contest: 'Second Contest' },
            confirmationToken: tokenForFirst,
          },
        },
      });
    });
    Then('the different contest is not closed', async () => {
      expect(await statusOf(app, jar, otherContestId)).toBe('live');
    });
    And('the host is asked to confirm that action instead', () => {
      expect(response.json().kind).toBe('confirm');
      expect(response.json().action).toBe('close_contest');
    });
  });

  Scenario('A confirmed action that fails is reported as failed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('they confirm a destructive action that cannot be carried out', async () => {
      /*
       * A contest that is already closed: the API refuses to close it again.
       * A name nobody has would no longer do — that is not a failure now, it is
       * "no contest has that name", which is a different answer with a different
       * shape and is exactly what the host should be told instead.
       */
      const name = 'Already Over';
      const contestId = await liveContest(app, jar, name);
      await request(app, jar, { method: 'POST', url: `/contests/${contestId}/close` });
      llm.next = {
        text: '',
        toolCalls: [{ name: 'close_contest', arguments: { contest: name } }],
      };
      const proposal = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: `Close ${name}` }] },
      });
      const { action, args, confirmationToken } = proposal.json();
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { confirm: { action, args, confirmationToken } },
      });
    });
    Then('the host is told it did not happen', () => {
      expect(response.json().kind).toBe('failed');
      expect(response.json().message).toEqual(expect.any(String));
    });
  });

  Scenario('Chatting with the assistant requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp(undefined, {}, new ScriptedLLMClient()));
    });
    When('a message is sent to the assistant', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'Close my contest' }] },
      });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('One message asking for several things gets all of them', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When(
      'they ask in one message to create a contest, judge it on two things, and have three people taking part',
      async () => {
        // Exactly what the model proposes for that sentence, in that order.
        llm.next = {
          text: '',
          toolCalls: [
            { name: 'create_draft', arguments: { name: 'Tapas' } },
            { name: 'add_category', arguments: { contest: 'Tapas', category: 'Taste' } },
            { name: 'add_category', arguments: { contest: 'Tapas', category: 'Originality' } },
            { name: 'add_participant', arguments: { contest: 'Tapas', participant: 'Carlos' } },
            { name: 'add_participant', arguments: { contest: 'Tapas', participant: 'Alba' } },
            { name: 'add_participant', arguments: { contest: 'Tapas', participant: 'Juan' } },
          ],
        };
        response = await request(app, jar, {
          method: 'POST',
          url: '/assistant/messages',
          payload: { messages: [{ role: 'user', content: 'Create a contest called Tapas...' }] },
        });
      },
    );
    Then('the contest exists, judged on both, with all three taking part', async () => {
      const details = await request(app, jar, {
        method: 'GET',
        url: '/contests/details?name=Tapas',
      });
      expect(details.json().details).toMatchObject({
        name: 'Tapas',
        categories: ['Taste', 'Originality'],
        participants: ['Carlos', 'Alba', 'Juan'],
      });
    });
    And('every step is reported, in the order it was asked for', () => {
      const turn = response.json();
      expect(turn.kind).toBe('steps');
      expect(turn.steps.map((step: { action: string }) => step.action)).toEqual([
        'create_draft',
        'add_category',
        'add_category',
        'add_participant',
        'add_participant',
        'add_participant',
      ]);
      expect(turn.notReached).toEqual([]);
    });
  });

  Scenario('A message asking for a single thing is answered as it always was', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host chatting with the assistant', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('they ask for one thing alone', async () => {
      llm.next = { text: '', toolCalls: [{ name: 'create_draft', arguments: { name: 'Just The One' } }] };
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'start a draft called Just The One' }] },
      });
    });
    /* The common case, unwrapped: no list of one. */
    Then('it is carried out and reported on its own', () => {
      expect(response.json().kind).toBe('result');
      expect(response.json().action).toBe('create_draft');
    });
  });

  Scenario(
    'Something irreversible is put to the host on its own, and ends the run',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let llm: ScriptedLLMClient;
      let response: LightMyRequestResponse;

      Given('a signed-in host with a draft ready to publish', async () => {
        llm = new ScriptedLLMClient();
        ({ app } = makeTestApp(undefined, {}, llm));
        jar = await signedInHost(app, 'ana@example.com');
        await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent('Ready') });
      });
      When('they ask in one message to judge it on one more thing and then publish it', async () => {
        llm.next = {
          text: '',
          toolCalls: [
            { name: 'add_category', arguments: { contest: 'Ready', category: 'Presentation' } },
            { name: 'publish_contest', arguments: { contest: 'Ready' } },
          ],
        };
        response = await request(app, jar, {
          method: 'POST',
          url: '/assistant/messages',
          payload: { messages: [{ role: 'user', content: 'add Presentation and publish it' }] },
        });
      });
      Then('the draft is judged on that thing', async () => {
        const details = await request(app, jar, { method: 'GET', url: '/contests/details?name=Ready' });
        expect(details.json().details.categories).toContain('Presentation');
      });
      And('the host is asked to confirm publishing', () => {
        const turn = response.json();
        expect(turn.kind).toBe('steps');
        expect(turn.steps.at(-1)).toMatchObject({ kind: 'confirm', action: 'publish_contest' });
      });
      And('the draft is not published', async () => {
        const details = await request(app, jar, { method: 'GET', url: '/contests/details?name=Ready' });
        expect(details.json().details.status).toBe('draft');
      });
    },
  );

  Scenario(
    'Nothing asked for after an irreversible action is carried out',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let llm: ScriptedLLMClient;
      let response: LightMyRequestResponse;

      Given('a signed-in host with a draft ready to publish', async () => {
        llm = new ScriptedLLMClient();
        ({ app } = makeTestApp(undefined, {}, llm));
        jar = await signedInHost(app, 'ana@example.com');
        await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent('Ready') });
      });
      When('they ask in one message to publish it and then rename it', async () => {
        llm.next = {
          text: '',
          toolCalls: [
            { name: 'publish_contest', arguments: { contest: 'Ready' } },
            { name: 'rename_contest', arguments: { contest: 'Ready', name: 'Renamed After' } },
          ],
        };
        response = await request(app, jar, {
          method: 'POST',
          url: '/assistant/messages',
          payload: { messages: [{ role: 'user', content: 'publish it and rename it' }] },
        });
      });
      Then('the host is asked to confirm publishing', () => {
        expect(response.json().steps.at(-1)).toMatchObject({ kind: 'confirm', action: 'publish_contest' });
      });
      /*
       * The one with teeth. A confirmation approves the action it names; what a
       * message queued behind it was never part of what the host agreed to.
       */
      And('the draft still has the name it had', async () => {
        const byOldName = await request(app, jar, { method: 'GET', url: '/contests/details?name=Ready' });
        expect(byOldName.json().details?.name).toBe('Ready');
        // And the name it would have had is nobody's.
        const byNewName = await request(app, jar, {
          method: 'GET',
          url: '/contests/details?name=Renamed%20After',
        });
        expect(byNewName.json().candidates).toEqual([]);
      });
      And('what was not reached is named', () => {
        expect(response.json().notReached).toEqual(['rename_contest']);
      });
    },
  );

  Scenario('A step that cannot be carried out stops the ones after it', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let response: LightMyRequestResponse;

    Given('a signed-in host with a draft judged on "Taste"', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent('Tapas') });
    });
    When('they ask in one message to judge it on "Taste" again and then on "Presentation"', async () => {
      llm.next = {
        text: '',
        toolCalls: [
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Taste' } },
          { name: 'add_category', arguments: { contest: 'Tapas', category: 'Presentation' } },
        ],
      };
      response = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'judge it on Taste and Presentation' }] },
      });
    });
    Then('the repeat is reported as refused, with its reason', () => {
      const turn = response.json();
      expect(turn.steps).toHaveLength(1);
      expect(turn.steps[0]).toMatchObject({ kind: 'failed', action: 'add_category' });
      expect(turn.steps[0].message).toMatch(/already judged on/i);
    });
    And('the draft is not judged on "Presentation"', async () => {
      const details = await request(app, jar, { method: 'GET', url: '/contests/details?name=Tapas' });
      expect(details.json().details.categories).not.toContain('Presentation');
      expect(response.json().notReached).toEqual(['add_category']);
    });
  });
});

