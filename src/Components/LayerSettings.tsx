import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppContext, AppState, LayerState } from '../AppContext';
import { Keymap, ControlState, NumMIDIChannels } from '../Types';
import { LayerControlKey } from '../utils/DefaultDefinitions';
import { hexNotes } from '../utils/elysiumutils';
import Control from './Control';
import NumberInput from './NumberInput';

interface Props
{
    layerIndex: number;
}

export default function(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;
    const layer = state.layers[props.layerIndex];

    const layerControls: LayerControlKey[] = [
//        "enabled",
        "midiChannel",
        "key"
    ];

    const noteControls: LayerControlKey[] = [
        "transpose",
        "tempo",
        "barLength",
        "velocity",
        "emphasis",
        "noteLength"
    ];

    const generatorControls: LayerControlKey[] = [
        "timeToLive",
        "pulseEvery"
    ];

    function buildControl(controlKey: LayerControlKey)
    {
        return <Control
            controlId={state.layers[props.layerIndex][controlKey]}
            key={controlKey}
            layerIndex={props.layerIndex}
        />;
    }

    return (
        <div className="layerSettings">
            <div className="layerHeader">{state.layers[props.layerIndex].name}</div>
            <div className="scrolly">
                <div className="header">Layer</div>
                {layerControls.map(buildControl)}
                <div className="header">Notes</div>
                {noteControls.map(buildControl)}
                <div className="header">Generators</div>
                {generatorControls.map(buildControl)}
            </div>
        </div>
    );
};