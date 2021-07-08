import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppContext } from '../AppContext';
import { hexNotes } from '../utils/elysiumutils';
import TokenAdder from "../Components/TokenAdder";
import Control from './Control';
import TokenControl from './TokenControl';
import { remote } from 'electron';
import { confirmPrompt } from '../utils/utils';

interface Props
{
    layerIndex: number;
}

export default function(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;
    const [ toggledToken, setToggledToken ] = useState("");
    const oldTokenIds = useRef<string[]>([]);

    const tokenIds = state.layers[props.layerIndex].tokenIds[state.selectedHex];

    function handleRemove(tokenIndex: number)
    {
        if (!state.settings.confirmDelete ||
            confirmPrompt(`Are you sure you want to delete the ${state.tokens[tokenIds[tokenIndex]].label} token?`, "Confirm remove token"))
        {
            dispatch({ type: "removeTokenFromSelected", payload: { tokenIndex } });
        }
    }

    useEffect(() =>
    {
        if (state.selectedHex === -1 || tokenIds.length === 0) return;
        
        setToggledToken(tokenIds[0]);
        oldTokenIds.current = tokenIds;
    }, [ state.selectedHex, props.layerIndex ]);

    useEffect(() =>
    {
        if (state.selectedHex === -1 || tokenIds.length === 0) return;

        if (!tokenIds.includes(toggledToken) || tokenIds.length > oldTokenIds.current.length)
        {
            setToggledToken(tokenIds[tokenIds.length - 1]);
        }

        oldTokenIds.current = tokenIds;
    }, [ state.tokens ]);

    return (
        <div className="inspector">
            {state.selectedHex === -1 ? (
                <div className="selectedHexLabel">No hex selected.</div>
            ) : (<>
                <div className="selectedHexLabel">Selected: {hexNotes[state.selectedHex]}</div>
                <TokenAdder />
                <div className="tokens">
                    {tokenIds.map((tokenId, i) =>
                    (
                        <TokenControl
                            tokenId={tokenId}
                            onRemove={() => handleRemove(i)}
                            key={tokenId}
                            isCollapsed={tokenId !== toggledToken}
                            onToggleCollapse={() => toggledToken === tokenId ? setToggledToken("") : setToggledToken(tokenId)}
                        />
                    ))}
                </div>
            </>)}
        </div>
    );
};