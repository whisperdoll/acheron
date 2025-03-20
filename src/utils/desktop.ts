import { SerializedComposition } from "../Serialization";
import { AppState, AppStateStore } from "../state/AppState";
import { modalStateStore } from "../state/ModalState";

export function isOnDesktop() {
  return !!(window as any).__TAURI_INTERNALS__;
}

export function isOnWeb() {
  return !isOnDesktop();
}

export async function toggleDevtools() {
  if (!isOnDesktop()) return;

  const { invoke } = await import("@tauri-apps/api/core");
  invoke("plugin:webview|internal_toggle_devtools");
}

export async function openComposition(): Promise<
  SerializedComposition | undefined
> {
  if (isOnDesktop()) {
    const fs = await import("@tauri-apps/plugin-fs");
    const dialog = await import("@tauri-apps/plugin-dialog");

    const filepath = await dialog.open({
      title: "Open Composition...",
      filters: [{ name: "Acheron Composition", extensions: ["ache"] }],
      canCreateDirectories: true,
      directory: false,
      multiple: false,
    });

    if (!filepath) return;

    return JSON.parse(await fs.readTextFile(filepath));
  } else {
    return new Promise((resolve, reject) => {
      try {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".ache";

        fileInput.onchange = () => {
          if (!fileInput.files || !fileInput.files[0]) {
            resolve(undefined);
            return;
          }

          const file = fileInput.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            const fileContent = e.target?.result;
            if (typeof fileContent !== "string") {
              resolve(undefined);
              return;
            }

            resolve(JSON.parse(fileContent));
          };
          reader.readAsText(file);
        };

        fileInput.click();
      } catch (e) {
        reject(e);
      }
    });
  }
}

export async function openUrl(url: string) {
  if (isOnDesktop()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    openUrl(url);
  } else {
    window.open(url, "_blank");
  }
}

export async function confirmPrompt(
  prompt: string,
  title: string
): Promise<boolean> {
  if (false) {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return await ask(prompt, {
      title,
      kind: "info",
    });
  } else {
    return new Promise((resolve, reject) => {
      try {
        modalStateStore.add({
          title,
          prompt,
          confirmText: "Confirm",
          cancelText: "Cancel",
          type: "confirm",
          onCancel() {
            resolve(false);
          },
          onConfirm() {
            resolve(true);
          },
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}
