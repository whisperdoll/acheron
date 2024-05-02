import React, { useContext } from "react";
import { AppContext, AppSettings } from "../AppContext";
import { array_copy, array_remove, array_remove_at, confirmPrompt } from "../utils/utils";
import { TokenUID } from "../Types";
const remote = require('@electron/remote');

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
        dispatch({ type: "toggleTokenEnabled", payload: tokenUid, saveSettings: true });
    }

    function handlePathTextChanged(index: number, e: React.ChangeEvent<HTMLInputElement>)
    {
        dispatch({ type: "setTokenSearchPath", payload: { index, value: e.currentTarget.value, normalize: false } });
    }

    function browsePath(index: number)
    {
        const paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
            title: "Pick token search path...",
            properties: [ "openDirectory" ]
        });

        if (paths && paths[0])
        {
            dispatch({ type: "setTokenSearchPath", payload: { index, value: paths[0], normalize: true } });
        }
    }
    
    function removePath(index: number)
    {
        dispatch({ type: "removeTokenSearchPath", payload: index });
    }

    function addPath()
    {
        dispatch({ type: "addTokenSearchPath", payload: "" });
    }

    return (
        <div className="tokenSettings-backdrop">
            <div className="tokenSettings-content">
                <h1>Manage Tokens</h1>
                <div className="tokenSearchPaths-container">
                    <div>Token Search Paths</div>
                    {state.settings.tokenSearchPaths.map((path, i) => (
                        <div key={i} className="row">
                            <input
                                type="text"
                                value={path}
                                onChange={e => handlePathTextChanged(i, e)}
                            />
                            <button onClick={() => browsePath(i)}>Browse...</button>
                            <button onClick={() => removePath(i)}>❌ Remove</button>
                        </div>
                    ))}
                    <button onClick={addPath}>+ Add Search Path</button>
                </div>
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