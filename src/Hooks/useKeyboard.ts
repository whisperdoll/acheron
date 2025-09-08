import { useCallback } from "react";
import { keyboardStateStore } from "../state/KeyboardState";

export default function useKeyboard() {
  const isDown = useCallback(
    (
      key: string,
      modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
    ) => {
      return !!(
        keyboardStateStore.values[key] &&
        (!modifiers.ctrl || keyboardStateStore.values.Control) &&
        (!modifiers.shift || keyboardStateStore.values.Shift) &&
        (!modifiers.alt || keyboardStateStore.values.Alt)
      );
    },
    []
  );

  return { keyboardStateStore, isDown };
}
