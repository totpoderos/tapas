import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeTestApp, seedHost } from '../support/test-server.js';

/**
 * The seam between the rules form and the API, over the real HTTP route with
 * real repositories.
 *
 * Both halves of this are covered on their own — the form's by a component test
 * with a faked client, the API's by a unit test with a fake repository — and a
 * seam is exactly where two well-tested halves agree with each other until the
 * day they do not. The payloads below are the ones the two forms now send,
 * written out literally rather than built by importing anything, so this fails
 * if either side changes its mind about the shape.
 *
 * What it is pinning: a category's id is the API's to assign and nobody's to
 * overwrite. The forms used to derive `c1..cn` from the row's position and send
 * that, so every save renumbered what the contest was judged on.
 */

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

async function signedInCookie(app: FastifyInstance): Promise<string> {
  await seedHost(app, 'seam@example.com', STRONG_PASSWORD);
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'seam@example.com', password: STRONG_PASSWORD },
  });
  return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

describe('a category keeps its identity across the form and the API', async () => {
  it('names a category the create form sent by name alone', async () => {
    const { app } = await makeTestApp();
    const cookie = await signedInCookie(app);

    // Exactly what new-contest.tsx now sends: names, no ids.
    const created = await app.inject({
      method: 'POST',
      url: '/drafts',
      headers: { cookie },
      payload: {
        name: 'Tapas',
        format: 'solo',
        scoring: {
          categories: [{ name: 'Taste' }, { name: 'Originality' }],
          range: { type: 'fixed', min: 1, max: 5 },
          uniquePerCategory: false,
        },
      },
    });

    expect(created.statusCode).toBe(201);
    const categories = created.json().content.scoring.categories;
    expect(categories.map((category: { name: string }) => category.name)).toEqual([
      'Taste',
      'Originality',
    ]);
    for (const category of categories) expect(category.id).toBeTruthy();
    expect(new Set(categories.map((category: { id: string }) => category.id)).size).toBe(2);

    await app.close();
  });

  it('leaves the ids alone when the rules are saved again', async () => {
    const { app } = await makeTestApp();
    const cookie = await signedInCookie(app);

    const created = await app.inject({
      method: 'POST',
      url: '/drafts',
      headers: { cookie },
      payload: {
        name: 'Tapas',
        format: 'solo',
        scoring: {
          categories: [{ name: 'Taste' }, { name: 'Originality' }],
          range: { type: 'fixed', min: 1, max: 5 },
          uniquePerCategory: false,
        },
      },
    });
    const draft = created.json();
    const assigned = draft.content.scoring.categories as { id: string; name: string }[];

    /*
     * What draft-editor.tsx now sends after a save: the two it loaded, with the
     * ids they came with, plus a third the host has just typed and which has no
     * identity yet. The old form sent c1/c2/c3 here and the first two changed
     * their meaning.
     */
    const saved = await app.inject({
      method: 'PUT',
      url: `/drafts/${draft.id}`,
      headers: { cookie },
      payload: {
        name: 'Tapas',
        format: 'solo',
        scoring: {
          categories: [
            { id: assigned[0]!.id, name: 'Taste' },
            { id: assigned[1]!.id, name: 'Originality' },
            { name: 'Presentation' },
          ],
          range: { type: 'fixed', min: 1, max: 5 },
          uniquePerCategory: false,
        },
      },
    });

    expect(saved.statusCode).toBe(200);
    const after = saved.json().content.scoring.categories as { id: string; name: string }[];
    expect(after[0]).toEqual(assigned[0]);
    expect(after[1]).toEqual(assigned[1]);
    expect(after[2]!.name).toBe('Presentation');
    expect(after[2]!.id).toBeTruthy();
    expect(new Set(after.map((category) => category.id)).size).toBe(3);

    await app.close();
  });

  /*
   * Renaming is where the old behaviour was at its worst: the name is the only
   * thing the host changed, and the id moved anyway.
   */
  it('keeps a category the same one when the host renames it', async () => {
    const { app } = await makeTestApp();
    const cookie = await signedInCookie(app);

    const created = await app.inject({
      method: 'POST',
      url: '/drafts',
      headers: { cookie },
      payload: {
        name: 'Tapas',
        scoring: {
          categories: [{ name: 'Taste' }],
          range: { type: 'auto' },
          uniquePerCategory: false,
        },
      },
    });
    const draft = created.json();
    const before = draft.content.scoring.categories[0] as { id: string; name: string };

    const saved = await app.inject({
      method: 'PUT',
      url: `/drafts/${draft.id}`,
      headers: { cookie },
      payload: {
        name: 'Tapas',
        scoring: {
          categories: [{ id: before.id, name: 'Flavour' }],
          range: { type: 'auto' },
          uniquePerCategory: false,
        },
      },
    });

    const after = saved.json().content.scoring.categories[0];
    expect(after.id).toBe(before.id);
    expect(after.name).toBe('Flavour');

    await app.close();
  });
});
