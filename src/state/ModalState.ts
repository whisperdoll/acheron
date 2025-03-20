import StateStore from "./state";

type ModalConfigWithoutId =
  | {
      type: "confirm";
      title: string;
      prompt: string;
      confirmText: string;
      cancelText: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    }
  | {
      type: "prompt";
      title: string;
      prompt: string;
      confirmText: string;
      cancelText: string;
      onConfirm?: (value: string) => void;
      onCancel?: () => void;
    };

export type ModalConfig = ModalConfigWithoutId & { id: string };

interface ModalState {
  modals: ModalConfig[];
}

export class ModalStateStore extends StateStore<ModalState> {
  constructor() {
    super({ modals: [] });
  }

  private newId(): string {
    let uuid = crypto.randomUUID();

    while (this.values.modals.some((m) => m.id === uuid)) {
      uuid = crypto.randomUUID();
    }

    return uuid;
  }

  remove(id: string) {
    this.set(
      (s) => ({ modals: s.modals.filter((m) => m.id !== id) }),
      "remove modal"
    );
  }

  add(modal: ModalConfigWithoutId) {
    this.set(
      (s) => ({ modals: s.modals.concat([{ ...modal, id: this.newId() }]) }),
      "add modal"
    );
  }
}

export const modalStateStore = new ModalStateStore();
modalStateStore.initialize();
