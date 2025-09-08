import StateStore from "./state";

type KeyboardState = Record<string, boolean>;

export class KeyboardStateStore extends StateStore<KeyboardState> {}

export const keyboardStateStore = new KeyboardStateStore({});
keyboardStateStore.initialize();

document.addEventListener("keydown", (e) => {
  keyboardStateStore.values[e.key] = true;
});

document.addEventListener("keyup", (e) => {
  keyboardStateStore.values[e.key] = false;
});
