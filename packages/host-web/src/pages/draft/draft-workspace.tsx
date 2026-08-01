import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useParams } from 'react-router';
import { Button, Callout, Card } from '@tapas/ui';
import { ApiError, getDraft, publishDraft, updateDraft, type DraftContent } from '../../api/client';
import { useContests } from '../../contests/contests-provider';
import { PanelActions, PanelNote } from '../../shell/panel-actions';
import { DraftEditorProvider, useDraftEditor } from './draft-editor';
import styles from './draft-workspace.module.css';

/** A stable id, so the header's Save button can name the form it submits. */
export const FORM_ID = 'review-draft-form';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly content: DraftContent }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error' };

/**
 * A contest being prepared, and the two sections it is prepared in.
 *
 * The draft is read here, once, and held here while the host works — so its rules
 * and its people are two views of one thing rather than two screens with two
 * copies. Moving between them neither saves nor discards, because there is nothing
 * between them to reconcile: the fields change, the draft does not.
 *
 * Saving, publishing and what is still missing belong here for the same reason.
 * They are about the whole contest and not about one section of it, so they are
 * offered wherever the host is standing.
 */
export function DraftWorkspace() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    getDraft(id)
      .then((draft) => {
        if (!live) return;
        setState({ kind: 'ready', content: draft.content });
      })
      .catch((caught) => {
        if (!live) return;
        setState(
          caught instanceof ApiError && caught.status === 404
            ? { kind: 'missing' }
            : { kind: 'error' },
        );
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <main id="main">
        <p role="status" className={styles.note}>
          {t('reviewDraft.loading')}
        </p>
      </main>
    );
  }
  if (state.kind === 'missing') {
    return (
      <main id="main">
        <h1 className={styles.title}>{t('reviewDraft.notFoundTitle')}</h1>
        <p className={styles.note}>{t('reviewDraft.notFoundBody')}</p>
      </main>
    );
  }
  if (state.kind === 'error') {
    return (
      <main id="main">
        <p role="alert" className={styles.note}>
          {t('reviewDraft.loadError')}
        </p>
      </main>
    );
  }

  // Keyed on the draft, so asking for a different one starts from that one's
  // content rather than carrying the last one's edits into it.
  return (
    <DraftEditorProvider key={id} initial={state.content}>
      <DraftAtWork draftId={id} />
    </DraftEditorProvider>
  );
}

/** The draft once it is in hand: its header actions, its checklist, and its sections. */
function DraftAtWork({ draftId }: { readonly draftId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh: refreshContests } = useContests();
  const editor = useDraftEditor();

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // "Saved." stands only for the draft that was saved. With two sections a host
  // can save, move, and change something else, and a note still saying "Saved."
  // over the new change would be claiming something untrue.
  const saved = savedAt !== null && savedAt === editor.revision;

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSavedAt(null);
    if (!editor.name.trim()) {
      // Said twice on purpose: beside the field, which is on the rules, and here,
      // which is on both sections — a host saving from the participants must be
      // told why it did not save without having to go looking for the field.
      editor.setNameError(t('reviewDraft.nameRequired'));
      setError(t('reviewDraft.nameRequired'));
      return;
    }
    editor.setNameError(undefined);
    setSaving(true);
    try {
      await updateDraft(draftId, editor.buildContent());
      setSavedAt(editor.revision);
    } catch {
      setError(t('reviewDraft.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setError(undefined);
    setPublishing(true);
    try {
      await publishDraft(draftId);
      // The panel names this contest and says what state it is in, from the shared
      // list — which still has it as a draft until told otherwise. Without this the
      // control room opens under a sidebar insisting the live contest is a draft.
      refreshContests();
      // Straight to the control room rather than back to the list: the contest is
      // live, and the join code is the very next thing the host needs.
      navigate(`/contest/${draftId}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? t('reviewDraft.publishError', { reason: caught.message })
          : t('reviewDraft.publishErrorGeneric'),
      );
      setPublishing(false);
    }
  }

  return (
    <main id="main">
      <PanelActions>
        {/* Announced where it happens, so a host is not left wondering whether a
            change took — a form that swallows a save is one saved twice. */}
        <span role="status" className={styles.savedNote}>
          {saved ? t('reviewDraft.saved') : ''}
        </span>
        <Button type="submit" form={FORM_ID} variant="ghost" disabled={saving}>
          {saving ? t('reviewDraft.saving') : t('reviewDraft.save')}
        </Button>
        <Button onClick={() => void onPublish()} disabled={publishing}>
          {publishing ? t('reviewDraft.publishing') : t('reviewDraft.publish')}
        </Button>
      </PanelActions>

      {/* What the draft still needs, where the host sees it without scrolling, on
          whichever section they are on. The navigation cannot work this out: it
          knows the contest list, not what is inside a draft. */}
      {editor.unpartnered.length > 0 && (
        <PanelNote>
          <Callout tone="saffron" title={t('reviewDraft.beforePublishing')}>
            <p>{t('reviewDraft.checkWantingPartner', { count: editor.unpartnered.length })}</p>
          </Callout>
        </PanelNote>
      )}

      {/* The contest is named once, above both sections, because it is the same
          contest either way. Each section heads itself underneath. */}
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('reviewDraft.editTitle', { name: editor.name })}</h1>
        <p className={styles.lead}>{t('reviewDraft.lead')}</p>
      </div>

      {error ? (
        <div className={styles.wide}>
          <Callout tone="danger" role="alert">
            <p>{error}</p>
          </Callout>
        </div>
      ) : null}

      {/* One form over both sections, so the header's Save names one thing and a
          section's fields are always inside it whichever section is mounted. */}
      <form id={FORM_ID} className={styles.columns} onSubmit={onSave} noValidate>
        <div className={styles.main}>
          <Outlet />
        </div>

        <div className={styles.aside}>
          <Card title={t('reviewDraft.checklistTitle')} level={3}>
            <PublishChecklist />
          </Card>
        </div>
      </form>
    </main>
  );
}

/**
 * What is ready and what is not, worked out from the draft in front of the host.
 *
 * A prediction, not a verdict: publishing still asks the API and the API's answer
 * still governs. This exists so a host is not left pressing publish and reading a
 * refusal to find out what was missing — and it describes the whole contest, not
 * one section of it, which is why it is beside both.
 */
function PublishChecklist() {
  const { t } = useTranslation();
  const { name, categories, rangeType, rangeMin, rangeMax, people, unpartnered } = useDraftEditor();

  const nameSet = name.trim().length > 0;
  const categoryCount = categories.filter((c) => c.name.trim()).length;
  /*
   * Counted as the roster is sent, unfiltered — a participant whose name has not
   * been typed yet is still somebody `buildContent()` writes and `compile()`
   * counts, so filtering here would make this disagree with what publishing sees.
   */
  const peopleCount = people.length;
  const wanting = unpartnered.length;

  const items = [
    {
      key: 'name',
      ready: nameSet,
      text: nameSet ? t('reviewDraft.checkName') : t('reviewDraft.checkNameMissing'),
    },
    {
      key: 'categories',
      ready: categoryCount > 0,
      text:
        categoryCount > 0
          ? t('reviewDraft.checkCategories', { count: categoryCount })
          : t('reviewDraft.checkCategoriesMissing'),
    },
    {
      key: 'range',
      ready: true,
      text:
        rangeType === 'auto'
          ? t('reviewDraft.checkRangeAuto')
          : t('reviewDraft.checkRangeFixed', { min: rangeMin, max: rangeMax }),
    },
    /*
     * Two counts are certain refusals, so they can be predicted exactly: nobody at
     * all is `NO_PARTICIPANTS`, and one person alone gets one dish that nobody may
     * score — their own — so the only judge can score nothing and
     * `JUDGE_CANNOT_SCORE_ANY_DISH` follows, whatever the other rules say.
     *
     * Above the pairing item on purpose: having people at all comes before whether
     * they are paired, and a contest with nobody in it should not be told about
     * pairing first.
     *
     * Anything beyond the count — whether every judge can score something once
     * the format and the pairings are taken together — is `compile()`'s answer
     * and stays with the server.
     */
    {
      key: 'people',
      ready: peopleCount >= 2,
      text:
        peopleCount === 0
          ? t('reviewDraft.checkNobodyTakingPart')
          : peopleCount === 1
            ? t('reviewDraft.checkOnlyOneTakingPart')
            : t('reviewDraft.checkPeopleTakingPart', { count: peopleCount }),
    },
    ...(wanting > 0
      ? [
          {
            key: 'pairing',
            ready: false,
            text: t('reviewDraft.checkWantingPartner', { count: wanting }),
          },
        ]
      : []),
  ];
  const ready = items.every((item) => item.ready);

  return (
    <>
      <ul className={styles.checklist}>
        {items.map((item) => (
          <li key={item.key} className={item.ready ? styles.done : styles.todo}>
            {/* A mark and a wording, never the colour alone. */}
            <span aria-hidden="true" className={styles.mark}>
              {item.ready ? '✓' : '!'}
            </span>
            {item.text}
          </li>
        ))}
      </ul>
      <p className={ready ? styles.readyNote : styles.notReadyNote} role="status">
        {ready ? t('reviewDraft.readyToPublish') : t('reviewDraft.notReadyToPublish')}
      </p>
    </>
  );
}
