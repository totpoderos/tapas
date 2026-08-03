import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContestFormat, DraftContent, ScoreRange } from '../../api/client';

export interface Category {
  /** This row, for React and for the remove button. Never the category's identity. */
  readonly key: string;
  /**
   * What the contest is judged on, as the API knows it. Absent for a row the
   * host has just typed — the API names it at save, the way it names a
   * participant added by name alone. Carried through a save so that editing the
   * rules does not quietly make new categories out of the ones already there.
   */
  readonly id?: string;
  readonly name: string;
}

export interface EditPerson {
  readonly id: string;
  readonly displayName: string;
  readonly partnerId: string | null;
}

/**
 * Everything the two sections of a contest being prepared read and change.
 *
 * The rules and the people are two views of one draft, so the draft lives here —
 * above both of them — rather than in either. Moving between the sections mounts
 * one set of fields and unmounts the other; it never touches what is being edited,
 * which is what makes moving cost nothing and lose nothing.
 */
export interface DraftEditor {
  readonly name: string;
  readonly setName: (value: string) => void;
  readonly format: ContestFormat;
  readonly setFormat: (value: ContestFormat) => void;

  readonly categories: readonly Category[];
  readonly addCategory: (name: string) => void;
  readonly removeCategory: (key: string) => void;

  readonly rangeType: 'auto' | 'fixed';
  readonly setRangeType: (value: 'auto' | 'fixed') => void;
  readonly rangeMin: string;
  readonly setRangeMin: (value: string) => void;
  readonly rangeMax: string;
  readonly setRangeMax: (value: string) => void;
  readonly uniquePerCategory: boolean;
  readonly setUniquePerCategory: (value: boolean) => void;

  readonly people: readonly EditPerson[];
  readonly addPerson: (displayName: string) => void;
  readonly renamePerson: (personId: string, displayName: string) => void;
  readonly removePerson: (personId: string) => void;
  readonly setPartner: (personId: string, partnerId: string | null) => void;

  /** Whether a partner does anything under this format, and so whether to ask for one. */
  readonly partnersMatter: boolean;

  /** Said where the name is typed. The whole-draft version is on the workspace. */
  readonly nameError: string | undefined;
  readonly setNameError: (value: string | undefined) => void;

  /** Who has nobody to be paired with — only a problem when couples cook together. */
  readonly unpartnered: readonly EditPerson[];
  readonly couples: number;
  /** A person's name, or what to call them until they have one. */
  readonly nameOf: (person: EditPerson) => string;

  /**
   * Bumped by every change, so the workspace can tell a draft that has been saved
   * from one that has been saved and then edited again.
   */
  readonly revision: number;

  readonly buildContent: () => DraftContent;
}

const DraftEditorContext = createContext<DraftEditor | null>(null);

/** Reads the draft as it arrived. */
function toEditPeople(
  participants: DraftContent['participants'],
  freshId: () => string,
): EditPerson[] {
  return (participants ?? []).map((p) => ({
    id: p.id || freshId(),
    displayName: p.displayName,
    partnerId: p.partnerId ?? null,
  }));
}

/**
 * Holds one contest being prepared while its host works on it, whichever of its
 * two sections they are on.
 *
 * Mounted only once the draft has been read, so every field starts from something
 * real rather than from a blank that fills in later.
 */
export function DraftEditorProvider({
  initial,
  children,
}: {
  readonly initial: DraftContent;
  readonly children: ReactNode;
}) {
  const { t } = useTranslation();
  const nextKey = useRef(0);
  const freshId = () => `new-${nextKey.current++}`;

  const [revision, setRevision] = useState(0);
  const touch = () => setRevision((n) => n + 1);

  const [name, setNameState] = useState(initial.name);
  const [format, setFormatState] = useState<ContestFormat>(initial.format ?? 'solo');
  const [categories, setCategories] = useState<Category[]>(() =>
    (initial.scoring?.categories ?? []).map((cat) => ({ key: freshId(), id: cat.id, name: cat.name })),
  );
  const initialRange = initial.scoring?.range;
  const [rangeType, setRangeTypeState] = useState<'auto' | 'fixed'>(
    initialRange?.type === 'fixed' ? 'fixed' : 'auto',
  );
  const [rangeMin, setRangeMinState] = useState(
    initialRange?.type === 'fixed' ? String(initialRange.min) : '1',
  );
  const [rangeMax, setRangeMaxState] = useState(
    initialRange?.type === 'fixed' ? String(initialRange.max) : '10',
  );
  const [uniquePerCategory, setUniquePerCategoryState] = useState(
    initial.scoring?.uniquePerCategory ?? true,
  );
  const [people, setPeople] = useState<EditPerson[]>(() =>
    toEditPeople(initial.participants, freshId),
  );
  const [nameError, setNameError] = useState<string | undefined>();

  /** Every change goes through here, so nothing can be changed without being counted. */
  function change<T>(set: (value: T) => void): (value: T) => void {
    return (value) => {
      set(value);
      touch();
    };
  }

  const editor: DraftEditor = {
    name,
    setName: change(setNameState),
    format,
    setFormat: change(setFormatState),

    categories,
    addCategory: (label) => {
      const value = label.trim();
      if (!value) return;
      setCategories((cs) => [...cs, { key: freshId(), name: value }]);
      touch();
    },
    removeCategory: (key) => {
      setCategories((cs) => cs.filter((c) => c.key !== key));
      touch();
    },

    rangeType,
    setRangeType: change(setRangeTypeState),
    rangeMin,
    setRangeMin: change(setRangeMinState),
    rangeMax,
    setRangeMax: change(setRangeMaxState),
    uniquePerCategory,
    setUniquePerCategory: change(setUniquePerCategoryState),

    people,
    addPerson: (displayName) => {
      const value = displayName.trim();
      if (!value) return;
      setPeople((ps) => [...ps, { id: freshId(), displayName: value, partnerId: null }]);
      touch();
    },
    renamePerson: (personId, displayName) => {
      setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, displayName } : p)));
      touch();
    },
    /** Removes a person and the partner back-link that named them. */
    removePerson: (personId) => {
      setPeople((ps) =>
        ps
          .filter((p) => p.id !== personId)
          .map((p) => ({ ...p, partnerId: p.partnerId === personId ? null : p.partnerId })),
      );
      touch();
    },
    /** Pairs two people, reciprocally; clearing one clears both. */
    setPartner: (personId, partnerId) => {
      setPeople((ps) => {
        const previous = ps.find((p) => p.id === personId)?.partnerId ?? null;
        return ps.map((p) => {
          if (p.id === personId) return { ...p, partnerId };
          if (partnerId && p.id === partnerId) return { ...p, partnerId: personId };
          // Break the old pairing's back-link, and any other person that pointed here.
          if (p.id === previous || (p.partnerId === personId && p.id !== partnerId)) {
            return { ...p, partnerId: null };
          }
          return p;
        });
      });
      touch();
    },
    /*
     * A partner does something under two of the three formats and nothing under
     * the third, so it is asked for under two and not the third. Pairings already
     * recorded are kept either way — see `buildContent`.
     */
    partnersMatter: format !== 'solo',

    nameError,
    setNameError,

    unpartnered: format === 'couples' ? people.filter((p) => !p.partnerId) : [],
    couples: new Set(
      people.filter((p) => p.partnerId).map((p) => [p.id, p.partnerId].sort().join('~')),
    ).size,
    nameOf: (person) =>
      person.displayName ||
      t('reviewDraft.participantFallback', { number: people.indexOf(person) + 1 }),

    revision,

    buildContent: () => {
      const range: ScoreRange =
        rangeType === 'fixed'
          ? { type: 'fixed', min: Number(rangeMin), max: Number(rangeMax) }
          : { type: 'auto' };
      return {
        name: name.trim(),
        format,
        scoring: {
          /*
           * Each category keeps the identity it arrived with; a row the host has
           * just typed has none and the API names it. This used to be
           * `{ id: c${i + 1} }` derived from the row's position, so every save
           * renumbered the lot — a category added through the assistant came back
           * as "c2", and two categories that were one thing underneath were
           * quietly made into two rather than refused at publish.
           */
          categories: categories
            .map((c) => ({ ...c, name: c.name.trim() }))
            .filter((c) => c.name)
            .map((c) => (c.id ? { id: c.id, name: c.name } : { name: c.name })),
          range,
          uniquePerCategory,
        },
        /*
         * Pairings are stored whatever the format. Under `solo` a partner does
         * nothing, but it is a roster fact the format has no use for rather than a
         * rule that failed to apply — discarding it would lose work the host did,
         * and choosing another format brings it straight back.
         */
        participants: people.map((p) => ({
          id: p.id,
          displayName: p.displayName.trim(),
          ...(p.partnerId ? { partnerId: p.partnerId } : {}),
        })),
      };
    },
  };

  return <DraftEditorContext.Provider value={editor}>{children}</DraftEditorContext.Provider>;
}

/**
 * The contest being prepared, from either of its sections.
 *
 * Throws outside the workspace rather than handing back an empty draft: a section
 * rendered without one is a wiring mistake, and a silent blank form would hide it
 * until a host saved the blank over their contest.
 */
export function useDraftEditor(): DraftEditor {
  const editor = useContext(DraftEditorContext);
  if (!editor) throw new Error('useDraftEditor must be used inside a DraftEditorProvider');
  return editor;
}

/** Kept for the sections that only need to know whether a partner is wanted. */
export function useNeedsPartner(): (person: EditPerson) => boolean {
  const { format } = useDraftEditor();
  return useMemo(
    () => (person: EditPerson) => format === 'couples' && !person.partnerId,
    [format],
  );
}
