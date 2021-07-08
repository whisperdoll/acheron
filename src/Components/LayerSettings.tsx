import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppContext, AppState, LayerState } from '../AppContext';
import { KeyMap, ControlState, NumMIDIChannels } from '../Types';
import { LayerControlKey } from '../utils/DefaultDefinitions';
import { hexNotes } from '../utils/elysiumutils';
import Control from './Control';

interface Props
{
    layerIndex: number;
}

export default function(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;
    const layer = state.layers[props.layerIndex];

    const noteControls: LayerControlKey[] = [
        "transpose",
        "tempo",
        "barLength",
        "velocity",
        "emphasis",
        "noteLength"
    ];

    function onChange(newState: LayerState)
    {
        dispatch({ type: "setLayer", payload: { layerIndex: props.layerIndex, layerState: newState }});
    }

    function handleMIDIChanged(e: React.ChangeEvent<HTMLInputElement>)
    {
        const val = parseInt(e.currentTarget.value);
        if (isNaN(val)) return;
        if (val < 1 || val > NumMIDIChannels) return;

        onChange({ ...layer, midiChannel: val });
    }

    function handleKeyChanged(e: React.ChangeEvent<HTMLSelectElement>)
    {
        const val = parseInt(e.currentTarget.value);
        if (isNaN(val)) return;

        onChange({ ...layer, key: val });
    }

    const generatorControls: LayerControlKey[] = [
        "timeToLive",
        "pulseEvery"
    ];

    function buildControl(controlKey: LayerControlKey)
    {
        return <Control
            controlId={state.layers[props.layerIndex][controlKey]}
            key={controlKey}
        />;
    }

    return (
        <div className="layerSettings">
            <div className="header">Layer</div>
            <div className="control">
                <label className="clicky">
                    <input
                        type="checkbox"
                        checked={layer.enabled}
                        onChange={(e) => onChange({ ...layer, enabled: e.currentTarget.checked })}
                    /> Enabled
                </label>
                
            </div>
            <div className="control">
                <div className="labelRow">
                    <div className="label">MIDI Channel</div>
                </div>
                <input
                    type="number"
                    min={1}
                    max={NumMIDIChannels}
                    step={1}
                    onChange={handleMIDIChanged}
                    value={layer.midiChannel}
                />
            </div>
            <div className="control">
                <div className="labelRow">
                    <div className="label">Key</div>
                </div>
                <select
                    onChange={handleKeyChanged}
                    value={layer.key}
                >
                    {Object.keys(KeyMap).map((key, i) => (
                        <option value={i} key={key}>{key}</option>
                    ))}
                </select>
            </div>
            <div className="header">Notes</div>
            {noteControls.map(buildControl)}
            <div className="header">Generators</div>
            {generatorControls.map(buildControl)}
        </div>
    );
};