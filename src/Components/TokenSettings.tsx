import React, { useContext } from "react";
import { AppContext, AppSettings } from "../AppContext";
import { array_copy, array_remove, array_remove_at, confirmPrompt } from "../utils/utils";
import { remote } from "electron";
import { loadToken } from "../Tokens";

interface Props
{
    onHide: () => any;
}

export default function Settings(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;

    function handleShortcutKey(e: React.KeyboardEvent<HTMLInputElement>, path: string)
    {
        if ([...e.key].length === 1)
        {
            dispatch({ type: "setTokenShortcut", payload: { path, shortcut: e.key }, saveSettings: true });
        }
        else if (e.key === "Delete" || e.key === "Backspace")
        {
            dispatch({ type: "clearTokenShortcut", payload: { path }, saveSettings: true });
        }
    }

    function addToken()
    {
        const paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
            title: "Open Token Folder...",
            properties: [ "openDirectory", "multiSelections" ]
        });

        if (paths)
        {
            paths.forEach((path) =>
            {
                const res = loadToken(path);
                if (res)
                {
                    dispatch({ type: "setTokenDefinition", payload: {
                        path,
                        callbacks: res.callbacks,
                        definition: res.tokenDef
                    }});
                }
            });
        }
    }

    function promptRemoveToken(path: string)
    {
        if (!state.settings.confirmDelete ||
            confirmPrompt(`Are you sure you want to remove the token '${state.tokenDefinitions[path].label}'?`, "Confirm remove token"))
        {
            dispatch({ type: "removeTokenDefinition", payload: { path }, saveSettings: true });
        }
    }
    
    return (
        <div className="tokenSettings-backdrop">
            <div className="tokenSettings-content">
                <h1>Manage Tokens</h1>
                {Object.entries(state.settings.tokens).map(([path, settings]) => (
                    <div className="tokenSetting" key={path}>
                        <div className="tokenLabel">{state.tokenDefinitions[path].label}</div>
                        <div className="row">
                            <span>Shortcut:</span>
                            <input
                                type="text"
                                onKeyDown={(e) => handleShortcutKey(e, path)}
                                value={settings.shortcut.toUpperCase()}
                            />
                        </div>
                        <button
                            onClick={() => promptRemoveToken(path)}
                        >❌ Remove</button>
                    </div>
                ))}
                <button
                    onClick={addToken}
                >+ Add Token</button>
                <div className="bottomButtons">
                    <button onClick={() => props.onHide()}>OK</button>
                </div>
            </div>
        </div>
    );
}