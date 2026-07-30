import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The two places a surface can put something into the panel around it: the header's
 * actions, and a note in the navigation.
 *
 * Both are portals rather than contexts holding a `ReactNode`, because passing an
 * element up through state means an effect on every surface, a first render where
 * the panel is empty before that effect runs, and a cleanup racing the next
 * surface's setup — all to do what the DOM already does. A surface that renders
 * nothing leaves the container empty.
 */
interface Slots {
  readonly actions: HTMLElement | null;
  readonly note: HTMLElement | null;
}

const SlotContext = createContext<Slots>({ actions: null, note: null });

export function PanelSlotProvider({ slots, children }: { slots: Slots; children: ReactNode }) {
  return <SlotContext.Provider value={slots}>{children}</SlotContext.Provider>;
}

/**
 * Renders its children into the panel's header.
 *
 * Nothing until the slot exists — on the very first render the container has not
 * been attached yet, and there is no sense in rendering these buttons into the
 * surface where they would flash in the wrong place before moving.
 *
 * A submit button placed here is outside its `<form>` in the DOM, so it must name
 * the form it belongs to: `<Button type="submit" form="…">`.
 */
export function PanelActions({ children }: { children: ReactNode }) {
  const { actions } = useContext(SlotContext);
  return actions ? createPortal(children, actions) : null;
}

/**
 * Renders its children into the panel's navigation, under whatever the surface is
 * scoped to.
 *
 * For something the host should see without scrolling the surface — what a draft
 * still needs before it can be published, say. The navigation cannot work that out
 * itself: it knows the contest list, not what is inside a draft.
 */
export function PanelNote({ children }: { children: ReactNode }) {
  const { note } = useContext(SlotContext);
  return note ? createPortal(children, note) : null;
}
