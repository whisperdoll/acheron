import Dict from "./dict";

const mods = ["ctrl", "alt", "shift"] as const;
type Mod = (typeof mods)[number];

const macModMap: Record<Mod, string> = {
  ctrl: "cmd",
  alt: "option",
  shift: "shift",
};

function capitalize<S extends string>(s: S): Capitalize<S> {
  return (s.substr(0, 1).toUpperCase() + s.substr(1)) as Capitalize<S>;
}

function isMac() {
  if (typeof navigator === "undefined") return false;

  let userAgent = (navigator as any)?.userAgentData?.platform;

  if (typeof userAgent !== "string") {
    userAgent = navigator.platform;
    if (typeof userAgent !== "string") return false;
  }

  return userAgent.toLowerCase().includes("mac");
}

export type KeyboardShortcut = { [key in Mod]?: boolean } & {
  key: string;
};

export function shortcutsEqual(k1: KeyboardShortcut, k2: KeyboardShortcut) {
  return (
    k1.key.toLowerCase() === k2.key.toLowerCase() &&
    mods.every((m) => k1[m] == k2[m])
  );
}

export function keyboardShortcutString(shortcut: KeyboardShortcut) {
  const usedMods = mods.filter((m) => shortcut[m]);
  const mappedToPlatform = isMac()
    ? usedMods.map((m) => macModMap[m])
    : usedMods;
  const modString = mappedToPlatform.map(capitalize).join("+");

  return `${modString && modString + "+"}${shortcut.key}`;
}

export function keyboardShortcutTriggered<T extends KeyboardShortcut>(
  e: KeyboardEvent,
  ...shortcuts: T[]
) {
  // console.log(
  //   e.key.toLowerCase(),
  //   shortcuts,
  //   Dict.fromArray(mods.map((m) => [m, e[`${m}Key`]])),
  //   shortcuts.find(
  //     (s) =>
  //       e.key.toLowerCase() === s.key.toLowerCase() &&
  //       mods.every((m) => !!s[m] === !!e[`${m}Key`])
  //   )
  // );
  return shortcuts.find(
    (s) =>
      e.key.toLowerCase() === s.key.toLowerCase() &&
      mods.every((m) => !!s[m] === !!e[`${m}Key`])
  );
}

export function addKeyboardShortcutEventListeners(
  shortcuts: (KeyboardShortcut & { onTrigger: () => void })[]
) {
  const listener = (e: KeyboardEvent) => {
    const triggered = keyboardShortcutTriggered(e, ...shortcuts);
    if (triggered) {
      e.preventDefault();
      triggered.onTrigger();
    }
  };

  document.addEventListener("keydown", listener);

  return () => document.removeEventListener("keydown", listener);
}
