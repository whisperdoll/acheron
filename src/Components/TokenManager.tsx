import React, { useContext } from "react";
import { TokenUID } from "../Types";
import state from "../state/AppState";
import settings from "../state/AppSettings";

interface Props {
  onHide: () => any;
}

export default function TokenManager(props: Props) {
  const reactiveState = state.useState();
  const reactiveSettings = settings.useState();

  function handleShortcutKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    uid: TokenUID
  ) {
    if ([...e.key].length === 1) {
      settings.set(
        {
          tokens: {
            ...reactiveSettings.tokens,
            [uid]: { ...reactiveSettings.tokens[uid], shortcut: e.key },
          },
        },
        "set token shortcut"
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
          "clear token shortcut"
        );
      }
    }
  }

  // function addToken()
  // {
  //     const paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
  //         title: "Open Token Folder...",
  //         properties: [ "openDirectory", "multiSelections" ]
  //     });

  //     if (paths)
  //     {
  //         paths.forEach((path) =>
  //         {
  //             const res = loadToken(path);
  //             if (res)
  //             {
  //                 dispatch({ type: "setTokenDefinition", payload: {
  //                     path,
  //                     callbacks: res.callbacks,
  //                     definition: res.tokenDef
  //                 }});
  //             }
  //         });
  //     }
  // }

  // function promptRemoveToken(path: string)
  // {
  //     if (!state.settings.confirmDelete ||
  //         confirmPrompt(`Are you sure you want to remove the token '${state.tokenDefinitions[path].label}'?`, "Confirm remove token"))
  //     {
  //         dispatch({ type: "removeTokenDefinition", payload: { path }, saveSettings: true });
  //     }
  // }

  function toggleEnabled(tokenUid: TokenUID) {}

  function handlePathTextChanged(
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) {}

  function browsePath(index: number) {}

  function removePath(index: number) {}

  function addPath() {}

  return (
    <div className="tokenSettings-backdrop">
      <div className="tokenSettings-content">
        <h1>Manage Tokens</h1>
        <div className="tokenSearchPaths-container">
          <div>Token Search Paths</div>

          <button onClick={addPath}>+ Add Search Path</button>
        </div>
        <div className="tokenSettings">
          {Object.entries(reactiveSettings.tokens).map(([uid, settings]) => (
            <div className="tokenSetting" key={uid}>
              <div className="tokenLabel">
                {reactiveState.tokenDefinitions[uid].label}
              </div>
              <div className="row">
                <span>Shortcut:</span>
                <input
                  type="text"
                  onKeyDown={(e) => handleShortcutKey(e, uid)}
                  value={settings.shortcut.toUpperCase()}
                />
              </div>
              {/* <button
                                onClick={() => promptRemoveToken(path)}
                            >❌ Remove</button> */}
            </div>
          ))}
        </div>
        {/* <button
                    onClick={addToken}
                >+ Add Token</button> */}
        <div className="bottomButtons">
          <button onClick={() => props.onHide()}>OK</button>
        </div>
      </div>
    </div>
  );
}
