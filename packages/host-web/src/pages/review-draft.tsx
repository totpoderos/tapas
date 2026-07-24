import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, FormField } from '@tapas/ui';
import {
  ApiError,
  getDraft,
  publishDraft,
  renameDraft,
  type Attribution,
  type AntiBias,
  type ScoreRange,
  type StoredDraft,
} from '../api/client';
import styles from './review-draft.module.css';

const ATTRIBUTION: Record<Attribution, string> = {
  per_person: 'Each person is scored on their own',
  per_couple: 'Each couple is scored together',
};
const ANTI_BIAS: Record<AntiBias, string> = {
  none: 'No restriction',
  couples: 'Couples cannot score each other',
  arbitrary_pairs: 'Chosen pairs cannot score each other',
};
const NOT_SET = 'Not set yet';

function rangeLabel(range: ScoreRange): string {
  return range.type === 'fixed' ? `${range.min}–${range.max}` : 'Set automatically';
}

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly draft: StoredDraft }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error' };

/**
 * Reviewing a draft before it goes live: the host sees the rules they chose,
 * can rename it, and publishes it into a live contest. Editing the rule space
 * (and couple pairing) is a later slice — the API only exposes rename and
 * publish today. Publish failures (an incomplete draft, or rules that would
 * leave a judge unable to score) are surfaced with the API's own reason.
 */
export function ReviewDraft() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    getDraft(id)
      .then((draft) => {
        if (!live) return;
        setState({ kind: 'ready', draft });
        setName(draft.content.name);
      })
      .catch((caught) => {
        if (!live) return;
        setState(caught instanceof ApiError && caught.status === 404 ? { kind: 'missing' } : { kind: 'error' });
      });
    return () => {
      live = false;
    };
  }, [id]);

  async function onRename(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || renaming) return;
    setRenaming(true);
    try {
      await renameDraft(id, name.trim());
    } finally {
      setRenaming(false);
    }
  }

  async function onPublish() {
    setPublishError(undefined);
    setPublishing(true);
    try {
      await publishDraft(id);
      navigate('/'); // it is a live contest now; the list shows it as such
    } catch (caught) {
      setPublishError(
        caught instanceof ApiError && caught.message
          ? `This contest can’t go live yet: ${caught.message}`
          : 'This contest couldn’t be published. Please try again.',
      );
      setPublishing(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>Tapas</b>
        </div>
        <Link to="/" className={styles.back}>
          Back to contests
        </Link>
      </div>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          Loading the draft…
        </p>
      )}
      {state.kind === 'missing' && (
        <>
          <h1 className={styles.title}>Draft not found</h1>
          <p className={styles.note}>This draft doesn’t exist, or isn’t yours to review.</p>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          The draft couldn’t be loaded. Please try again.
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          <h1 className={styles.title}>Review “{name}”</h1>
          <p className={styles.lead}>
            Check the rules over, then publish it when you’re ready to go live.
          </p>

          {publishError ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{publishError}</span>
            </div>
          ) : null}

          <RuleSummary draft={state.draft} />

          <form className={styles.rename} onSubmit={onRename}>
            <FormField
              id="draft-name"
              label="Contest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="ghost" disabled={renaming}>
              {renaming ? 'Renaming…' : 'Rename'}
            </Button>
          </form>

          <div className={styles.actions}>
            <Button type="button" onClick={() => void onPublish()} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish — go live'}
            </Button>
            <Link to="/" className={styles.back}>
              Cancel
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

function RuleSummary({ draft }: { draft: StoredDraft }) {
  const { attribution, antiBias, scoring, participants } = draft.content;
  return (
    <dl className={styles.rules} aria-label="Contest rules">
      <div className={styles.rule}>
        <dt className={styles.ruleLabel}>Attribution</dt>
        <dd className={styles.ruleValue}>{attribution ? ATTRIBUTION[attribution] : NOT_SET}</dd>
      </div>
      <div className={styles.rule}>
        <dt className={styles.ruleLabel}>Guarding against bias</dt>
        <dd className={styles.ruleValue}>{antiBias ? ANTI_BIAS[antiBias] : NOT_SET}</dd>
      </div>
      <div className={styles.rule}>
        <dt className={styles.ruleLabel}>Scoring categories</dt>
        <dd className={styles.ruleValue}>
          {scoring && scoring.categories.length > 0 ? (
            <ul className={styles.tags}>
              {scoring.categories.map((category) => (
                <li key={category.id} className={styles.tag}>
                  {category.name}
                </li>
              ))}
            </ul>
          ) : (
            NOT_SET
          )}
        </dd>
      </div>
      <div className={styles.rule}>
        <dt className={styles.ruleLabel}>Score range</dt>
        <dd className={styles.ruleValue}>{scoring ? rangeLabel(scoring.range) : NOT_SET}</dd>
      </div>
      <div className={styles.rule}>
        <dt className={styles.ruleLabel}>Participants</dt>
        <dd className={styles.ruleValue}>
          {participants && participants.length > 0 ? (
            <ul className={styles.tags}>
              {participants.map((person) => (
                <li key={person.id} className={styles.tag}>
                  {person.displayName}
                </li>
              ))}
            </ul>
          ) : (
            NOT_SET
          )}
        </dd>
      </div>
    </dl>
  );
}
