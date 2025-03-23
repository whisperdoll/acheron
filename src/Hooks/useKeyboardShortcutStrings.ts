import { useMemo } from "react";
import Dict from "../lib/dict";
import { keyboardShortcutString } from "../lib/keyboard";
import settings from "../state/AppSettings";

export default function useKeyboardShortcutStrings() {
  const keyboardShortcuts = settings.useState((s) => s.keyboardShortcuts);
  const keyboardShortcutStrings = useMemo(
    () => Dict.transformedValues(keyboardShortcuts, keyboardShortcutString),
    [keyboardShortcuts]
  );

  return keyboardShortcutStrings;
}
