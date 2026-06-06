import { useEffect, useRef } from "react";

export default function useInterval(callback: (delta: number) => unknown, delay: number) {
  const savedCallback = useRef<(delta: number) => unknown>(() => 0);
  const lastTime = useRef<number>(performance.now());

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      const now = performance.now();
      savedCallback.current(now - lastTime.current);
      lastTime.current = now;
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
