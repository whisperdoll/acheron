import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppContext, AppState } from '../AppContext';
import { PlayerControlKey, PlayerControlKeys } from '../utils/DefaultDefinitions';
import Control from './Control';

export default function()
{
    const { state, dispatch } = useContext(AppContext)!;

    const noteControls: PlayerControlKey[] = [
        "transpose",
        "tempo",
        "barLength",
        "velocity",
        "emphasis",
        "tempoSync",
        "noteLength"
    ];

    const generatorControls: PlayerControlKey[] = [
        "timeToLive",
        "pulseEvery"
    ];

    function buildControl(controlKey: PlayerControlKey)
    {
        return <Control
            controlId={state[controlKey]}
            key={controlKey}
            layerIndex={-1}
        />;
    }

    return (
        <div className="playerSettings">
            <div className="header">Notes</div>
            {noteControls.map(buildControl)}
            <div className="header">Generators</div>
            {generatorControls.map(buildControl)}
        </div>
    );
};