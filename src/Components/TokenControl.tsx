import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Control from './Control';
import { ControlState, Token } from '../Types';
import { AppContext } from '../AppContext';

interface Props
{
    tokenId: string;
    onRemove: () => any;
    isCollapsed: boolean;
    onToggleCollapse: () => any;
    layerIndex: number;
}

export default function(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;

    const token = state.tokens[props.tokenId];

    return (
        <div className="tokenControl">
            <div className="header" onClick={() => props.onToggleCollapse()}>
                <span className="noselect">{token.label} [click to {props.isCollapsed ? "expand" : "collapse"}]</span>
                <button className="nostyle remove" onClick={(e) => { e.stopPropagation(); props.onRemove() }}>❌</button>
            </div>
            {!props.isCollapsed && token.controlIds.map((controlId) =>
            (
                <Control
                    controlId={controlId}
                    key={controlId}
                    layerIndex={props.layerIndex}
                />
            ))}
        </div>
    );
};