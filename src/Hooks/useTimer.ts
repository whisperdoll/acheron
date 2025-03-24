import { useCallback, useEffect, useRef } from "react";
import timerWorkerPath from "../../assets/timerWorker.js?url";

interface Props {
  onTick: (deltaMs: number) => void;
}

export default function useTimer(props: Props) {
  const lastTime = useRef<number | null>(null);
  const timerWorker = useRef<Worker | null>(null);
  const onTick = useRef(props.onTick);

  useEffect(() => {
    onTick.current = props.onTick;
  }, [props.onTick]);

  const start = useCallback(() => {
    if (!timerWorker.current) {
      timerWorker.current = new Worker(timerWorkerPath);

      timerWorker.current.addEventListener("message", (e) => {
        // const now = performance.now();
        // console.log("meow", {
        //   realDeltaMs: now - lastTime.current!,
        //   deltaMs: e.data,
        //   now,
        // });
        onTick.current(performance.now() - lastTime.current!);
        lastTime.current = performance.now();
      });
    }
    lastTime.current = performance.now();
    timerWorker.current.postMessage("start");
  }, []);

  const stop = useCallback(() => {
    if (!timerWorker.current) return;

    timerWorker.current.postMessage("stop");
  }, []);

  return [start, stop];
}
