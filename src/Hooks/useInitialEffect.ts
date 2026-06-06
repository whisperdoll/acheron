import { useEffect, useRef } from "react";

export default function useInitialEffect(fn: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fn, []);
}
