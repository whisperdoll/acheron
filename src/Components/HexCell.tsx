import React, { useContext, useEffect, useLayoutEffect } from 'react';
import { noteFromIndex } from '../utils/elysiumutils';

interface Props
{
    noteIndex: number;
}

export default function(props: Props)
{
    return (
        <div className="hexCell">
            <div className="hexCell-in1">
                <div className="hexCell-in2">
                    <span>{noteFromIndex(props.noteIndex)}</span>
                </div>
            </div>
        </div>
    )
}