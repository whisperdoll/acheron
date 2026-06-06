import { useEffect, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export default function usePropRef<T extends Function>(fn: T | undefined) {
  const ref = useRef(fn);

  useEffect(() => {
    ref.current = fn;
  }, [fn]);

  return ref;
}
