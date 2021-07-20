import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Control from './Control';
import { ControlState, getControlValue, Token } from '../Types';
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
            {
                const ret = <Control
                    controlId={controlId}
                    key={controlId}
                    layerIndex={props.layerIndex}
                />;

                const control = state.controls[controlId];
                if (control.showIf !== undefined)
                {
                    const key = control.showIf.startsWith("!") ? control.showIf.substr(1) : control.showIf;
                    const shouldNegate = control.showIf.startsWith("!");
                    const index = token.controlIds.findIndex(cid => state.controls[cid].key === key);

                    if (index !== -1)
                    {
                        const bool = Boolean(getControlValue(state, props.layerIndex, state.controls[token.controlIds[index]]));
                        console.log(bool, shouldNegate, bool !== shouldNegate);
                        return bool !== shouldNegate ? ret : undefined;
                    }
                    else
                    {
                        return undefined;
                    }
                }
                else
                {
                    return ret;
                }
            })}
        </div>
    );
};