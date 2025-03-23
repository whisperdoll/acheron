import { useEffect, useRef } from "react";

export default function useLazyRef<T>(generator: () => T) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    ref.current = generator();
  }, []);

  return ref;
}
