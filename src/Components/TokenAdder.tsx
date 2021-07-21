import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppContext } from '../AppContext';
import { hexNotes } from '../utils/elysiumutils';
import { capitalize } from '../utils/utils';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faPlus } from '@fortawesome/free-solid-svg-icons';
import IconButton from './IconButton';

export default function TokenAdder()
{
    const { state, dispatch } = useContext(AppContext)!;
    const [ isShowingTokens, setIsShowingTokens ] = useState(false);

    if (state.selectedHex.hexIndex === -1) return <></>;

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
            <IconButton
                onClick={toggleTokens}
                className={"addButton " + (isShowingTokens ? "expanded" : "collapsed")}
                icon={isShowingTokens ? faBan : faPlus}
            >
                {isShowingTokens ? "Cancel Adding Token" : "Add Token"}
            </IconButton>
            {isShowingTokens &&
                <div className="tokenAdderList">
                    {Object.entries(state.tokenDefinitions).map(([ key, definition ]) => (
                        <button
                            className="tokenAdderButton"
                            onClick={() => { addToken(key); setIsShowingTokens(false); }}
                            key={key}
                        >
                                {"Add " + definition.label + (state.settings.tokens[definition.uid].enabled ? "" : " (disabled)")}
                        </button>
                    ))}
                </div>
            }
        </div>
    );
};