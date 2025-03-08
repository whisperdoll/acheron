import { useEffect, useRef } from "react";

export default function useImmediate(
  callback: (delta: number) => any,
  isOn: boolean
) {
  const savedCallback = useRef<(delta: number) => any>(() => 0);
  const savedId = useRef<NodeJS.Immediate | null>(null);
  const lastTime = useRef<number>(performance.now());
  const savedIsOn = useRef<boolean>(false);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    savedIsOn.current = isOn;

    function tick() {
      if (!savedIsOn.current) return;
      const now = performance.now();
      savedCallback.current(now - lastTime.current);
      lastTime.current = now;
      setImmediate(tick);
    }

    if (isOn) {
      lastTime.current = performance.now();
      savedId.current = setImmediate(tick);
    } else if (savedId.current) {
      clearImmediate(savedId.current);
    }
  }, [isOn]);
}
