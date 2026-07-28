import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@tapas/ui';
import { deleteContest, needsNameToDelete } from '../api/client';

interface Target {
  readonly id: string;
  readonly name: string;
}

type Stage = 'confirm' | 'verify';

/**
 * Deleting a contest from anywhere in the host app: the confirmation, the
 * escalation to a typed name, the call, and the error.
 *
 * It lives in one hook because the contest list and the control room both offer
 * delete, and two copies of an irreversible flow is two chances to get the guard
 * wrong.
 *
 * The escalation is driven by the API, not guessed here: the first attempt goes
 * without a name, and only a `428` — the API's "someone has taken part, make them
 * type it" — turns the dialog into the typed-name one. So the rule for when the
 * name is needed lives in exactly one place, which is the place every entry point
 * passes through.
 */
export function useDeleteContest(onDeleted: (target: Target) => void) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<Target | null>(null);
  const [stage, setStage] = useState<Stage>('confirm');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function ask(next: Target) {
    setTarget(next);
    setStage('confirm');
    setError(undefined);
  }

  function dismiss() {
    setTarget(null);
    setStage('confirm');
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteContest(target.id, stage === 'verify' ? target.name : undefined);
      setTarget(null);
      setStage('confirm');
      onDeleted(target);
    } catch (caught) {
      if (needsNameToDelete(caught)) {
        setStage('verify'); // people have taken part — ask for the name and stay open
      } else {
        setError(t('deleteContest.error'));
        setTarget(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const dialog = target ? (
    <ConfirmDialog
      title={t('deleteContest.title', { name: target.name })}
      body={
        stage === 'verify' ? t('deleteContest.bodyTakenPart') : t('deleteContest.body')
      }
      confirmLabel={t('deleteContest.confirm')}
      cancelLabel={t('deleteContest.cancel')}
      workingLabel={t('deleteContest.working')}
      variant="danger"
      busy={busy}
      verify={
        stage === 'verify'
          ? {
              expected: target.name,
              label: t('deleteContest.verifyLabel'),
              hint: t('deleteContest.verifyHint', { name: target.name }),
            }
          : undefined
      }
      onConfirm={() => void confirm()}
      onCancel={dismiss}
    />
  ) : null;

  return { ask, dialog, error };
}
