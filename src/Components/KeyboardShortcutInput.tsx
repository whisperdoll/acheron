import { KeyboardShortcut, keyboardShortcutString } from "../lib/keyboard";

interface Props {
  onChange: (shortcut: KeyboardShortcut | null) => void;
  shortcut: KeyboardShortcut | null;
}

export default function KeyboardShortcutInput(props: Props) {
  function handleChange(e: React.KeyboardEvent<HTMLInputElement>) {
    if ([...e.key].length === 1) {
      props.onChange({
        key: e.key,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
      });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      props.onChange(null);
    }
  }

  return (
    <input
      type="text"
      value={(props.shortcut && keyboardShortcutString(props.shortcut)) || ""}
      onKeyDown={handleChange}
    ></input>
  );
}
