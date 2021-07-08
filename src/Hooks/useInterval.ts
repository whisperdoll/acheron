import React, { useState, useEffect, useRef } from 'react';

export default function useInterval(callback: (delta: number) => any, delay: number) {
    const savedCallback = useRef<(delta: number) => any>(() => 0);
    const lastTime = useRef<bigint>(process.hrtime.bigint());
    
    // Remember the latest callback.
    useEffect(() =>
    {
        savedCallback.current = callback;
    }, [ callback ]);
    
    // Set up the interval.
    useEffect(() =>
    {
        function tick()
        {
            const now = process.hrtime.bigint();
            savedCallback.current(Number(now - lastTime.current));
            lastTime.current = now;
        }

        if (delay !== null)
        {
            let id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [ delay ]);
}