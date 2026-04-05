import React, { useContext } from "react";
import { TokenUID } from "../Types";
import settings from "../state/AppSettings";
import { AppContext } from "../state/AppState";

interface Props {
  onHide: () => any;
}

export default function TokenManager(props: Props) {
  const { state, setState } = useContext(AppContext)!;
  const reactiveSettings = settings.useState();

  function handleShortcutKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    uid: TokenUID,
  ) {
    if ([...e.key].length === 1) {
      settings.set(
        {
          tokens: {
            ...reactiveSettings.tokens,
            [uid]: { ...reactiveSettings.tokens[uid], shortcut: e.key },
          },
        },
        "set token shortcut",
      );
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if ([...e.key].length === 1) {
        settings.set(
          {
            tokens: {
              ...reactiveSettings.tokens,
              [uid]: { ...reactiveSettings.tokens[uid], shortcut: "" },
            },
          },
          "clear token shortcut",
        );
      }
    }
  }

  function addPath() {}

  return (
    <>
      <h2>Tokens</h2>
      <div className="tokenSettings">
        {Object.entries(reactiveSettings.tokens).map(([uid, settings]) => (
          <div className="tokenSetting" key={uid}>
            <div className="tokenLabel">
              {state.tokenDefinitions[uid].label}
            </div>
            <div className="row">
              <span>Shortcut:</span>
              <input
                type="text"
                onKeyDown={(e) => handleShortcutKey(e, uid)}
                value={settings.shortcut.toUpperCase()}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
