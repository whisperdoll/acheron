import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function usePrevious<T>(value: T, defaultValue?: T) {
    const ref = useRef<T | undefined>(defaultValue);

    useEffect(() =>
    {
      ref.current = value;
    });

    return ref.current;
}