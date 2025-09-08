import { useCallback, useEffect, useState } from "react";
import { clamp, tryParseFloat } from "../lib/utils";
import "./Knob.scss";
import useKeyboard from "../Hooks/useKeyboard";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  minHint?: number;
  maxHint?: number;
  step?: number;
  slowStep?: number;
  knobSpeed?: number;
}

export default function Knob({
  value,
  onChange,
  min,
  max,
  minHint,
  maxHint,
  step = 1,
  slowStep = step / 10,
  knobSpeed = 1,
}: Props) {
  const displayMin = min ?? minHint ?? 0;
  const displayMax = max ?? maxHint ?? 100;
  const [mouseDown, setMouseDown] = useState(false);
  const stepsPerSecond = 1 / 16;
  const keyboard = useKeyboard();

  const handleMouseDown: React.PointerEventHandler = useCallback((e) => {
    e.preventDefault();
    setMouseDown(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: PointerEvent) => {
      if (!mouseDown) return;
      e.preventDefault();

      const movement = Math.sign(e.movementX - e.movementY);
      const delta = keyboard.isDown("Control")
        ? slowStep * movement * stepsPerSecond * knobSpeed
        : step * movement * stepsPerSecond * knobSpeed;
      let newValue = value + delta;
      if (typeof min === "number") {
        newValue = Math.max(newValue, min);
      }
      if (typeof max === "number") {
        newValue = Math.min(newValue, max);
      }
      onChange(newValue);
    };

    const handleMouseUp = (e: PointerEvent) => {
      setMouseDown(false);
    };

    document.addEventListener("pointermove", handleMouseMove);
    document.addEventListener("pointerup", handleMouseUp);

    return () => {
      document.removeEventListener("pointermove", handleMouseMove);
      document.removeEventListener("pointerup", handleMouseUp);
    };
  }, [mouseDown, onChange, step, value]);

  return (
    <div className="knobContainer">
      <div
        className="knob"
        style={{
          transform: `rotate(${((value - displayMin) / displayMax) * 360}deg)`,
        }}
        onPointerDown={handleMouseDown}
      ></div>
      <input
        value={Math.round(value * 100) / 100}
        type="number"
        onChange={(e) => onChange(tryParseFloat(e.currentTarget.value, 0))}
      />
    </div>
  );
}
