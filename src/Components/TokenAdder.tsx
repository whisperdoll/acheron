import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppContext } from '../AppContext';
import Tokens from '../Tokens';
import { hexNotes } from '../utils/elysiumutils';
import { capitalize } from '../utils/utils';

export default function TokenAdder()
{
    const { state, dispatch } = useContext(AppContext)!;
    const [ isShowingTokens, setIsShowingTokens ] = useState(false);

    if (state.selectedHex === -1) return <></>;

    function toggleTokens()
    {
        setIsShowingTokens(!isShowingTokens);
    }

    function addToken(tokenKey: string)
    {
        dispatch({ type: "addTokenToSelected", payload: { tokenKey } });
    }

    return (
        <div className="tokenAdder">
            <button
                onClick={toggleTokens}
                className={"addButton " + (isShowingTokens ? "expanded" : "collapsed")}
            >
                {isShowingTokens ? "❌ Cancel Adding Token" : "+ Add Token"}
            </button>
            {isShowingTokens &&
                <div className="tokenAdderList">
                    {Object.entries(state.tokenDefinitions).map(([ key, definition ]) => (
                        <button
                            className="tokenAdderButton"
                            onClick={() => { addToken(key); setIsShowingTokens(false); }}
                            key={key}
                        >
                                {"Add " + definition.label}
                        </button>
                    ))}
                </div>
            }
        </div>
    );
};