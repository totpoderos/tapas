import { useState, type ReactNode } from 'react';
import { PanelSlotProvider } from '../../../src/shell/panel-actions';

/**
 * The panel's slots, arranged exactly as the shell arranges them.
 *
 * Surfaces portal their own actions into the header and their own notes into the
 * navigation. Rendered without those containers they would not exist at all, so a
 * test of a surface on its own needs this standing in for the shell.
 *
 * In the tree rather than appended to the body, so `axe` sees what was portalled
 * too — buttons that escaped the container under test would otherwise go unchecked.
 */
export function WithPanelSlots({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [note, setNote] = useState<HTMLElement | null>(null);
  return (
    <>
      <div ref={setActions} />
      <div ref={setNote} />
      <PanelSlotProvider slots={{ actions, note }}>{children}</PanelSlotProvider>
    </>
  );
}
