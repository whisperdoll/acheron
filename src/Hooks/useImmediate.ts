import React, { useState, useEffect, useRef } from "react";

export default function useImmediate(callback: (delta: number) => any, isOn: boolean) {
    const savedCallback = useRef<(delta: number) => any>(() => 0);
    const savedId = useRef<NodeJS.Immediate | null>(null);
    const lastTime = useRef<bigint>(process.hrtime.bigint());
    const savedIsOn = useRef<boolean>(false);
    
    // Remember the latest callback.
    useEffect(() =>
    {
        savedCallback.current = callback;
    }, [ callback ]);
    
    // Set up the interval.
    useEffect(() =>
    {
        savedIsOn.current = isOn;

        function tick()
        {
            if (!savedIsOn.current) return;
            const now = process.hrtime.bigint();
            savedCallback.current(Number(now - lastTime.current));
            lastTime.current = now;
            setImmediate(tick);
        }

        if (isOn)
        {
            lastTime.current = process.hrtime.bigint();
            savedId.current = setImmediate(tick);
        }
        else if (savedId.current)
        {
            clearImmediate(savedId.current);
        }
    }, [ isOn ]);
}