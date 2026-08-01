import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AntiBias,
  Attribution,
  DraftContent,
  ScoreRange,
} from '../../api/client';

export interface Category {
  readonly key: string;
  readonly name: string;
}

export interface EditPerson {
  readonly id: string;
  readonly displayName: string;
  readonly partnerId: string | null;
  readonly noScoreWith: readonly string[];
}

/** A pair barred from scoring each other, held once rather than once per side. */
export interface BarredPair {
  readonly one: EditPerson;
  readonly other: EditPerson;
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
  readonly attribution: Attribution;
  readonly setAttribution: (value: Attribution) => void;
  readonly antiBias: AntiBias;
  readonly setAntiBias: (value: AntiBias) => void;

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
  readonly barPair: (oneId: string, otherId: string) => void;
  readonly liftPair: (oneId: string, otherId: string) => void;

  /** Said where the name is typed. The whole-draft version is on the workspace. */
  readonly nameError: string | undefined;
  readonly setNameError: (value: string | undefined) => void;

  /** Who has nobody to be paired with — only a problem when scoring is per couple. */
  readonly unpartnered: readonly EditPerson[];
  readonly couples: number;
  readonly barredPairs: readonly BarredPair[];
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

/**
 * Reads the draft as it arrived, with barring made mutual.
 *
 * The rule is offered as "chosen pairs cannot score each other", and this screen
 * used to write one direction only — so a draft saved back then may hold a bar
 * from Núria to Pau and nothing from Pau to Núria. Symmetrising on the way in
 * keeps everything downstream simple: the pairs list, the editor and what gets
 * stored all see the same symmetric thing, and saving makes it mutual for good.
 */
function toEditPeople(
  participants: DraftContent['participants'],
  freshId: () => string,
): EditPerson[] {
  const loaded = participants ?? [];
  const barred = new Map<string, Set<string>>(
    loaded.map((p) => [p.id, new Set(p.noScoreWith ?? [])]),
  );
  for (const person of loaded) {
    for (const againstId of person.noScoreWith ?? []) {
      barred.get(againstId)?.add(person.id);
    }
  }
  return loaded.map((p) => ({
    id: p.id || freshId(),
    displayName: p.displayName,
    partnerId: p.partnerId ?? null,
    noScoreWith: [...(barred.get(p.id) ?? [])],
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
  const [attribution, setAttributionState] = useState<Attribution>(
    initial.attribution ?? 'per_person',
  );
  const [antiBias, setAntiBiasState] = useState<AntiBias>(initial.antiBias ?? 'none');
  const [categories, setCategories] = useState<Category[]>(() =>
    (initial.scoring?.categories ?? []).map((cat) => ({ key: freshId(), name: cat.name })),
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
    attribution,
    setAttribution: change(setAttributionState),
    antiBias,
    setAntiBias: change(setAntiBiasState),

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
      setPeople((ps) => [...ps, { id: freshId(), displayName: value, partnerId: null, noScoreWith: [] }]);
      touch();
    },
    renamePerson: (personId, displayName) => {
      setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, displayName } : p)));
      touch();
    },
    /** Removes a person and every reference to them (a partner back-link, any no-score entries). */
    removePerson: (personId) => {
      setPeople((ps) =>
        ps
          .filter((p) => p.id !== personId)
          .map((p) => ({
            ...p,
            partnerId: p.partnerId === personId ? null : p.partnerId,
            noScoreWith: p.noScoreWith.filter((n) => n !== personId),
          })),
      );
      touch();
    },
    /** Pairs two people as a couple, reciprocally; clearing one clears both. */
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
    /**
     * Bars two people from scoring each other — both ways.
     *
     * The rule is offered as "chosen pairs cannot score each other", and it used to
     * write one direction only, so barring Núria from scoring Pau left Pau free to
     * score Núria. Pairing was already reciprocal; barring is now too, which is all
     * the compiler needs to keep the promise the option makes.
     */
    barPair: (oneId, otherId) => {
      if (oneId === otherId) return;
      setPeople((ps) =>
        ps.map((p) => {
          if (p.id !== oneId && p.id !== otherId) return p;
          const against = p.id === oneId ? otherId : oneId;
          return p.noScoreWith.includes(against)
            ? p
            : { ...p, noScoreWith: [...p.noScoreWith, against] };
        }),
      );
      touch();
    },
    /** Lifts a bar, both ways — including a half of one left by an older draft. */
    liftPair: (oneId, otherId) => {
      setPeople((ps) =>
        ps.map((p) =>
          p.id === oneId || p.id === otherId
            ? { ...p, noScoreWith: p.noScoreWith.filter((n) => n !== oneId && n !== otherId) }
            : p,
        ),
      );
      touch();
    },

    nameError,
    setNameError,

    unpartnered: attribution === 'per_couple' ? people.filter((p) => !p.partnerId) : [],
    couples: new Set(
      people.filter((p) => p.partnerId).map((p) => [p.id, p.partnerId].sort().join('~')),
    ).size,
    /*
     * Read from both sides, so a half-bar left by an older draft still shows as the
     * pair it was meant to be — and saving makes it mutual for good.
     */
    barredPairs: (() => {
      const seen = new Map<string, BarredPair>();
      for (const person of people) {
        for (const againstId of person.noScoreWith) {
          const other = people.find((p) => p.id === againstId);
          if (!other) continue;
          const key = [person.id, other.id].sort().join('~');
          if (!seen.has(key)) seen.set(key, { one: person, other });
        }
      }
      return [...seen.values()];
    })(),
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
        attribution,
        antiBias,
        scoring: {
          categories: categories
            .map((c) => c.name.trim())
            .filter(Boolean)
            .map((label, i) => ({ id: `c${i + 1}`, name: label })),
          range,
          uniquePerCategory,
        },
        participants: people.map((p) => ({
          id: p.id,
          displayName: p.displayName.trim(),
          ...(p.partnerId ? { partnerId: p.partnerId } : {}),
          ...(p.noScoreWith.length ? { noScoreWith: p.noScoreWith } : {}),
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
  const { attribution } = useDraftEditor();
  return useMemo(
    () => (person: EditPerson) => attribution === 'per_couple' && !person.partnerId,
    [attribution],
  );
}
