import { RefObject, useEffect, useRef } from "react";
import List from "../lib/list";

// Window
export default function useEventListener<K extends keyof WindowEventMap>(
  target: Window,
  event: K | K[],
  handler: (e: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void;

// Document
export default function useEventListener<K extends keyof DocumentEventMap>(
  target: Document,
  event: K | K[],
  handler: (e: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void;

// MediaQueryList
export default function useEventListener<K extends keyof MediaQueryListEventMap>(
  target: MediaQueryList,
  event: K | K[],
  handler: (e: MediaQueryListEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void;

// Element (HTMLElement + SVGElement)
export default function useEventListener<
  K extends keyof (HTMLElementEventMap & SVGElementEventMap),
  T extends Element,
>(
  target: T | RefObject<T | null>,
  event: K | K[],
  handler: (e: HTMLElementEventMap[K] | SVGElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void;

export default function useEventListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any,
  event: string | string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (e: any) => void,
  options?: boolean | AddEventListenerOptions,
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const el = target && "current" in target ? target.current : target;

    if (!el?.addEventListener) return;

    const listener = (e: Event) => {
      savedHandler.current(e);
    };

    const events = List.wrap(event);

    events.forEach((ev) => {
      el.addEventListener(ev, listener, options);
    });

    return () => {
      events.forEach((ev) => {
        el.removeEventListener(ev, listener, options);
      });
    };
  }, [target, event, options]);
}
