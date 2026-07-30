import { matchPath, useLocation } from 'react-router';
import { useSession } from '../auth/session';
import type { StateFilter } from '../contests/contest-state';

/**
 * Which navigation the panel is drawing, and which way in is the current one.
 *
 * The two kinds of work do not mix. An administrator's panel is administrative
 * work only; a host's is host work only, scoped to the deployment or to the one
 * contest they are inside. Nothing here authorizes anything — the API decides on
 * every request, and an administrator keeps a host's powers there. This only
 * says what to draw.
 */
export type PanelNav =
  | { readonly kind: 'admin'; readonly current: 'people' }
  | {
      readonly kind: 'deployment';
      readonly current: 'contests' | 'assistant' | 'new';
      /** Which state the contest list is narrowed to, when the host chose one. */
      readonly filter?: StateFilter;
    }
  | {
      readonly kind: 'contest';
      readonly contestId: string;
      readonly current: 'control' | 'log' | 'results';
    }
  | { readonly kind: 'draft'; readonly draftId: string; readonly current: 'review' };

/**
 * The host routes, each paired with what it makes current. `/people` is absent
 * on purpose: a host who reaches it keeps their host navigation and is told by
 * the screen that it is not for them — being there does not make them an
 * administrator.
 */
const HOST_ROUTES: readonly { pattern: string; nav: (id: string) => PanelNav }[] = [
  { pattern: '/chat', nav: () => ({ kind: 'deployment', current: 'assistant' }) },
  { pattern: '/new', nav: () => ({ kind: 'deployment', current: 'new' }) },
  { pattern: '/contest/:id', nav: (id) => ({ kind: 'contest', contestId: id, current: 'control' }) },
  { pattern: '/log/:id', nav: (id) => ({ kind: 'contest', contestId: id, current: 'log' }) },
  {
    pattern: '/results/:id',
    nav: (id) => ({ kind: 'contest', contestId: id, current: 'results' }),
  },
  { pattern: '/review/:id', nav: (id) => ({ kind: 'draft', draftId: id, current: 'review' }) },
];

/**
 * Derives the navigation from the current address and who is signed in, so no
 * page has to describe its own place in the panel. That is what stops the
 * eight-way drift the per-page chrome had: there is one answer, in one place.
 */
const FILTERS: readonly StateFilter[] = ['live', 'draft', 'finished'];

function filterFrom(search: string): StateFilter | undefined {
  const asked = new URLSearchParams(search).get('state');
  return FILTERS.find((f) => f === asked);
}

export function usePanelNav(): PanelNav {
  const { pathname, search } = useLocation();
  const { isAdministrator } = useSession();

  // The role picks the whole navigation, not a group inside it. An administrator
  // is sent to the people by the router, so every address resolves here to the
  // one surface their panel has.
  if (isAdministrator) return { kind: 'admin', current: 'people' };

  for (const route of HOST_ROUTES) {
    const match = matchPath(route.pattern, pathname);
    if (match) return route.nav(match.params.id ?? '');
  }

  return { kind: 'deployment', current: 'contests', filter: filterFrom(search) };
}
