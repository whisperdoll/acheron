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

    function handleOutputToggled(e: React.ChangeEvent<HTMLInputElement>, outputName: string)
    {
        if (state.settings.midiOutputs.includes(outputName))
        {
            dispatch({
                type: "setSelectedOutputs",
                payload: { names: state.settings.midiOutputs.filter(name => name !== outputName) },
                saveSettings: true
            });
        }
        else if (!state.settings.midiOutputs.includes(outputName))
        {
            dispatch({
                type: "setSelectedOutputs",
                payload: { names: state.settings.midiOutputs.concat([ outputName ]) },
                saveSettings: true
            });
        }
    }

    function handleInputToggled(e: React.ChangeEvent<HTMLInputElement>, inputName: string)
    {
        if (state.settings.midiInputs.includes(inputName))
        {
            dispatch({
                type: "setSelectedInputs",
                payload: { names: state.settings.midiInputs.filter(name => name !== inputName) },
                saveSettings: true
            });
        }
        else if (!state.settings.midiInputs.includes(inputName))
        {
            dispatch({
                type: "setSelectedInputs",
                payload: { names: state.settings.midiInputs.concat([ inputName ]) },
                saveSettings: true
            });
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
                    <div>MIDI Inputs:</div>
                    {state.allowedInputs.map((input) => (
                        <label className="clicky" key={input.name}>
                            <input
                                type="checkbox"
                                checked={state.settings.midiInputs.includes(input.name)}
                                onChange={(e) => handleInputToggled(e, input.name)}
                            />
                            <span>{input.name}</span>
                        </label>
                    ))}
                </div>
                <div className="midiSelect">
                    <div>MIDI Outputs:</div>
                    {state.allowedOutputs.map((output) => (
                        <label className="clicky" key={output.name}>
                            <input
                                type="checkbox"
                                checked={state.settings.midiOutputs.includes(output.name)}
                                onChange={(e) => handleOutputToggled(e, output.name)}
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