import React, { useContext } from "react";
import { AppContext, AppSettings } from "../AppContext";
import { array_copy, array_remove, array_remove_at } from "../utils/utils";

interface Props
{
    onHide: () => any;
}

export default function Settings(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;

    function handleCheckChanged(e: React.ChangeEvent<HTMLInputElement>, property: keyof AppSettings)
    {
        dispatch({ type: "setSettings", payload: { ...state.settings, [property]: e.currentTarget.checked }, saveSettings: true });
    }

    function handleOutputToggled(e: React.ChangeEvent<HTMLInputElement>, outputId: string)
    {
        if (state.selectedOutputs.includes(outputId))
        {
            const newOutputs = array_copy(state.selectedOutputs);
            array_remove(newOutputs, outputId);
            dispatch({ type: "setSelectedOutputs", payload: newOutputs });
        }
        else if (!state.selectedOutputs.includes(outputId))
        {
            dispatch({ type: "setSelectedOutputs", payload: state.selectedOutputs.concat([ outputId ])});
        }
    }
    
    return (
        <div className="settings-backdrop">
            <div className="settings-content">
                <h1>Settings</h1>
                <label className="clicky">
                    <input
                        type="checkbox"
                        checked={state.settings.playNoteOnClick}
                        onChange={(e) => handleCheckChanged(e, "playNoteOnClick")}
                    ></input>
                    <span>Play notes on click</span>
                </label>
                <label className="clicky">
                    <input
                        type="checkbox"
                        checked={state.settings.wrapPlayheads}
                        onChange={(e) => handleCheckChanged(e, "wrapPlayheads")}
                    ></input>
                    <span>Wrap playheads</span>
                </label>
                <label className="clicky">
                    <input
                        type="checkbox"
                        checked={state.settings.confirmDelete}
                        onChange={(e) => handleCheckChanged(e, "confirmDelete")}
                    ></input>
                    <span>Show confirmation prompts when removing things</span>
                </label>
                <div className="midiSelect">
                <div>MIDI Outputs:</div>
                    {state.allowedOutputs.map((output) => (
                        <label className="clicky">
                            <input
                                type="checkbox"
                                checked={state.selectedOutputs.includes(output.id)}
                                onChange={(e) => handleOutputToggled(e, output.id)}
                                key={output.id}
                            />
                            <span>{output.name}</span>
                        </label>
                    ))}
                </div>
                <div className="bottomButtons">
                    <button onClick={() => props.onHide()}>OK</button>
                </div>
            </div>
        </div>
    );
}