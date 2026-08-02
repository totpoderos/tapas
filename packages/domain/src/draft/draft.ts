import type { ContestFormat } from '../model.js';
import type { DraftContent } from './draft-content.js';

/** A broken draft invariant. */
export interface DraftInvariantError {
  readonly code: 'NAME_REQUIRED' | 'UNKNOWN_FORMAT';
  readonly message: string;
}

const FORMATS: readonly ContestFormat[] = ['solo', 'solo_with_partners', 'couples'];

export type DraftResult =
  | { readonly ok: true; readonly draft: Draft }
  | { readonly ok: false; readonly error: DraftInvariantError };

function checkName(name: string): DraftInvariantError | null {
  return name.trim().length === 0 ? { code: 'NAME_REQUIRED', message: 'A draft needs a name.' } : null;
}

/**
 * A draft may be incomplete, but it may not be nonsense: a format it does hold
 * has to be one a contest can have. Checked here rather than at the HTTP edge so
 * every way in — the form, the API, the MCP tools, the assistant — is held to it,
 * and so an unknown value is refused rather than stored and discovered at publish.
 */
function checkFormat(content: DraftContent): DraftInvariantError | null {
  if (content.format === undefined) return null;
  return FORMATS.includes(content.format)
    ? null
    : { code: 'UNKNOWN_FORMAT', message: `"${String(content.format)}" is not a format a contest can have.` };
}

function checkContent(content: DraftContent): DraftInvariantError | null {
  return checkName(content.name) ?? checkFormat(content);
}

/**
 * A contest draft aggregate. It owns its invariants (currently: a draft must
 * have a name). Immutable — mutating operations return a new `Draft` or an
 * error. Persistence metadata (timestamps, status) lives outside the domain.
 */
export class Draft {
  private constructor(
    readonly id: string,
    readonly hostId: string,
    readonly content: DraftContent,
  ) {}

  /** Create a new draft, enforcing invariants. */
  static create(id: string, hostId: string, content: DraftContent): DraftResult {
    const error = checkContent(content);
    return error ? { ok: false, error } : { ok: true, draft: new Draft(id, hostId, content) };
  }

  /** Reconstruct a draft already known to be valid (e.g. loaded from storage). */
  static rehydrate(id: string, hostId: string, content: DraftContent): Draft {
    return new Draft(id, hostId, content);
  }

  /** Rename the draft, enforcing invariants. Returns a new draft. */
  rename(newName: string): DraftResult {
    const error = checkName(newName);
    if (error) return { ok: false, error };
    return { ok: true, draft: new Draft(this.id, this.hostId, { ...this.content, name: newName }) };
  }

  /**
   * Replace the draft's whole content, enforcing invariants. Editing a draft is
   * a full replacement of the rules: a draft may be incomplete or not-yet-valid
   * (the full rules are checked at publish), so only the name is required here.
   * Returns a new draft.
   */
  withContent(newContent: DraftContent): DraftResult {
    const error = checkContent(newContent);
    if (error) return { ok: false, error };
    return { ok: true, draft: new Draft(this.id, this.hostId, newContent) };
  }
}
