import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Where a surface's own actions go: the panel's header.
 *
 * The shell owns the header and the surface owns the action, so something has to
 * bridge them. This is a portal rather than a context holding a `ReactNode`,
 * because passing an element up through state means an effect on every surface, a
 * first render where the header is empty before that effect runs, and a cleanup
 * racing the next surface's setup — all to do what the DOM already does.
 *
 * A surface that renders nothing here leaves the container empty, which is what
 * the contest list and the control room do.
 */
const SlotContext = createContext<HTMLElement | null>(null);

export function PanelActionsSlotProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null;
  children: ReactNode;
}) {
  return <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>;
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
  const slot = useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}
