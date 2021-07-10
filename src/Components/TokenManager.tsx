import React, { useContext } from "react";
import { AppContext, AppSettings } from "../AppContext";
import { array_copy, array_remove, array_remove_at, confirmPrompt } from "../utils/utils";
import { remote } from "electron";
import { TokenUID } from "../Types";

interface Props
{
    onHide: () => any;
}

export default function TokenManager(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;

    function handleShortcutKey(e: React.KeyboardEvent<HTMLInputElement>, uid: TokenUID)
    {
        if ([...e.key].length === 1)
        {
            dispatch({ type: "setTokenShortcut", payload: { uid, shortcut: e.key }, saveSettings: true });
        }
        else if (e.key === "Delete" || e.key === "Backspace")
        {
            dispatch({ type: "clearTokenShortcut", payload: uid, saveSettings: true });
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

    function toggleEnabled(tokenUid: TokenUID)
    {
        dispatch({ type: "toggleTokenEnabled", payload: tokenUid });
    }
    
    return (
        <div className="tokenSettings-backdrop">
            <div className="tokenSettings-content">
                <h1>Manage Tokens</h1>
                <div className="tokenSettings">
                    {Object.entries(state.settings.tokens).map(([uid, settings]) => (
                        <div className="tokenSetting" key={uid}>
                            <div className="tokenLabel">{state.tokenDefinitions[uid].label}</div>
                            <div className="row">
                                <label className="clicky">
                                    <input
                                        type="checkbox"
                                        onChange={() => toggleEnabled(uid)}
                                        checked={settings.enabled}
                                    />
                                    <span>Enabled</span>
                                </label>
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