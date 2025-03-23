import { KeyboardShortcut } from "./lib/keyboard";
import { isOnDesktop } from "./utils/desktop";

interface Listeners {
  open: () => void;
  saveAs: () => void;
  addLayer: () => void;
  devtools: () => void;
  toggleLeftColumn: () => void;
  toggleInspector: () => void;
  toggleMultilayer: () => void;
}

async function buildDefaultMenu(listeners: Listeners) {
  if (!isOnDesktop()) return;

  const { Menu, Submenu } = await import("@tauri-apps/api/menu");
  const { openUrl } = await import("@tauri-apps/plugin-opener");

  const menu = await Menu.new({
    items: [
      await Submenu.new({
        text: "&File",
        items: [
          {
            text: "&Open Composition...",
            accelerator: "Ctrl+O",
            action: listeners.open,
          },
          {
            text: "&Save Composition As...",
            accelerator: "Ctrl+S",
            action: listeners.saveAs,
          },
          { item: "Separator" },
          { item: "CloseWindow", text: "&Close" },
        ],
      }),
      await Submenu.new({
        text: "&Layer",
        items: [
          {
            text: "Add Layer",
            accelerator: "Ctrl+Shift+N",
            action: listeners.addLayer,
          },
        ],
      }),
      await Submenu.new({
        text: "&View",
        items: [
          {
            text: "&Reload",
            accelerator: "Ctrl+R",
            action: () => {
              location.reload();
            },
          },
          {
            text: "Toggle &Developer Tools",
            accelerator: "Alt+Ctrl+I",
            action: listeners.devtools,
          },
          { item: "Separator" },
          { item: "Fullscreen" },
          {
            text: "Toggle &Left Column",
            accelerator: "Ctrl+L",
            action: listeners.toggleLeftColumn,
          },
          {
            text: "Toggle &Inspector",
            accelerator: "Ctrl+I",
            action: listeners.toggleInspector,
          },
          {
            text: "Toggle &Multilayer Mode",
            accelerator: "Ctrl+M",
            action: listeners.toggleMultilayer,
          },
        ],
      }),
      await Submenu.new({
        text: "Help",
        items: [
          {
            text: "Documentation",
            action() {
              openUrl(
                "https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation"
              );
            },
          },
          {
            text: "Troubleshooting",
            action() {
              openUrl(
                "https://github.com/whisperdoll/acheron/blob/main/README.md#troubleshooting"
              );
            },
          },
          {
            text: "Report a Bug",
            action() {
              openUrl(
                "https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md"
              );
            },
          },
          {
            text: "Credits",
            action() {
              openUrl(
                "https://github.com/whisperdoll/acheron/blob/main/README.md#credits"
              );
            },
          },
        ],
      }),
    ],
  });

  await menu.setAsAppMenu();

  return menu;
}

async function buildMacMenu(listeners: Listeners) {
  if (!isOnDesktop()) return [];

  const { Menu, Submenu } = await import("@tauri-apps/api/menu");
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  const { getVersion } = await import("@tauri-apps/api/app");

  const shortcuts: KeyboardShortcut[] = [];
  const s = (shortcut: KeyboardShortcut): KeyboardShortcut => {
    shortcuts.push(shortcut);
    return shortcut;
  };

  const subMenuAbout = await Submenu.new({
    text: "Acheron",
    items: [
      {
        item: {
          About: {
            name: "Acheron",
            version: await getVersion(),
            credits:
              "https://github.com/whisperdoll/acheron/blob/main/README.md#credits",
          },
        },
      },
      { item: "Separator" },
      { item: "Services" },
      { item: "Separator" },
      { item: "Hide" },
      { item: "HideOthers" },
      { item: "ShowAll" },
      { item: "Separator" },
      { item: "Quit" },
    ],
  });

  const subMenuFile = await Submenu.new({
    text: "File",
    items: [
      {
        text: "Open Composition...",
        accelerator: "Command+O",
        action: listeners.open,
      },
      {
        text: "Save Composition As...",
        accelerator: "Command+S",
        action: listeners.saveAs,
      },
    ],
  });

  const subMenuEdit = await Submenu.new({
    text: "Edit",
    items: [
      { item: "Undo" },
      { item: "Redo" },
      { item: "Separator" },
      { item: "Cut" },
      { item: "Copy" },
      { item: "Paste" },
      { item: "SelectAll" },
    ],
  });

  const subMenuLayer = await Submenu.new({
    text: "&Layer",
    items: [
      {
        text: "Add Layer",
        accelerator: "Command+Shift+N",
        action: listeners.addLayer,
      },
    ],
  });

  const subMenuViewDev = await Submenu.new({
    text: "View",
    items: [
      {
        text: "Reload",
        accelerator: "Command+R",
        action: () => {
          location.reload();
        },
      },
      { item: "Fullscreen" },
      {
        text: "Toggle Developer Tools",
        accelerator: "Alt+Command+I",
        action: listeners.devtools,
      },
      {
        text: "Toggle Left Column",
        accelerator: "Command+L",
        action: listeners.toggleLeftColumn,
      },
      {
        text: "Toggle Inspector",
        accelerator: "Command+I",
        action: listeners.toggleInspector,
      },
      {
        text: "Toggle Multilayer Mode",
        accelerator: "Command+Shift+M",
        action: listeners.toggleMultilayer,
      },
    ],
  });

  const subMenuViewProd = await Submenu.new({
    text: "View",
    items: [
      { item: "Fullscreen" },
      {
        text: "Toggle Left Column",
        accelerator: "Command+L",
        action: listeners.toggleLeftColumn,
      },
      {
        text: "Toggle Inspector",
        accelerator: "Command+I",
        action: listeners.toggleInspector,
      },
      {
        text: "Toggle Multilayer Mode",
        accelerator: "Command+Shift+M",
        action: listeners.toggleMultilayer,
      },
    ],
  });

  const subMenuWindow = await Submenu.new({
    text: "Window",
    items: [
      { item: "Minimize" },
      { item: "CloseWindow" },
      { item: "Separator" },
      { item: "ShowAll" },
    ],
  });

  const subMenuHelp = await Submenu.new({
    text: "Help",
    items: [
      {
        text: "Documentation",
        action() {
          openUrl(
            "https://github.com/whisperdoll/acheron/wiki/Acheron-Documentation"
          );
        },
      },
      {
        text: "Troubleshooting",
        action() {
          openUrl(
            "https://github.com/whisperdoll/acheron/blob/main/README.md#troubleshooting"
          );
        },
      },
      {
        text: "Report a Bug",
        action() {
          openUrl(
            "https://github.com/whisperdoll/acheron/issues/new?assignees=&labels=bug&template=1-Bug_report.md"
          );
        },
      },
      {
        text: "Credits",
        action() {
          openUrl(
            "https://github.com/whisperdoll/acheron/blob/main/README.md#credits"
          );
        },
      },
    ],
  });

  const subMenuView = subMenuViewDev;

  const menu = await Menu.new({
    items: [
      subMenuAbout,
      subMenuFile,
      subMenuEdit,
      subMenuLayer,
      subMenuView,
      subMenuWindow,
      subMenuHelp,
    ],
  });

  await menu.setAsAppMenu();

  return menu;
}

export async function buildMenu(listeners: Listeners) {
  if (!isOnDesktop()) return [];

  const os = await import("@tauri-apps/plugin-os");
  if (os.type() === "macos") {
    return await buildMacMenu(listeners);
  } else {
    return await buildDefaultMenu(listeners);
  }
}
