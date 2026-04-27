import { useCallback, useEffect, useRef } from "react";
import { Point } from "../lib/utils";

export default function useDrag(
  onNewPosition: (
    position: Point,
    invertedPosition: Point,
    startPosition: Point,
    offset: Point,
  ) => unknown,
) {
  const dragging = useRef(false);
  const draggingStart = useRef<Point>({ x: 0, y: 0 });
  const referenceStart = useRef<Point>({ x: 0, y: 0 });

  const startDragging = useCallback(
    (e: { clientX: number; clientY: number }, startingPosition: Point) => {
      referenceStart.current = startingPosition;
      dragging.current = true;
      draggingStart.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;

      e.preventDefault();
      e.stopPropagation();

      const draggingCurrent = { x: e.clientX, y: e.clientY };
      const draggingOffset = {
        x: draggingCurrent.x - draggingStart.current.x,
        y: draggingCurrent.y - draggingStart.current.y,
      };

      const newPosition = {
        x: referenceStart.current.x + draggingOffset.x,
        y: referenceStart.current.y + draggingOffset.y,
      };

      const newPositionInverted = {
        x: referenceStart.current.x - draggingOffset.x,
        y: referenceStart.current.y - draggingOffset.y,
      };

      onNewPosition(newPosition, newPositionInverted, referenceStart.current, draggingOffset);
    };

    const onUp = (e: { preventDefault: () => unknown }) => {
      if (!dragging.current) return;

      e.preventDefault();
      dragging.current = false;
    };

    document.body.addEventListener("pointermove", onMove);
    document.body.addEventListener("pointerup", onUp);
    document.body.addEventListener("pointercancel", onUp);
    document.body.addEventListener("touchend", onUp);
    document.body.addEventListener("touchcancel", onUp);

    return () => {
      document.body.removeEventListener("pointermove", onMove);
      document.body.removeEventListener("pointerup", onUp);
      document.body.removeEventListener("pointercancel", onUp);
      document.body.removeEventListener("touchend", onUp);
      document.body.removeEventListener("touchcancel", onUp);
    };
  }, [onNewPosition]);

  return {
    dragging,
    startDragging,
  };
}
