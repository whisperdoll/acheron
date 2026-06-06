import React, { useCallback, useEffect, useRef, useState } from "react";
import useDrag from "../Hooks/useDrag";
import { Point, preventDefault } from "../lib/utils";
import usePropRef from "../Hooks/usePropRef";
import useEventListener from "../Hooks/useEventListener";

export interface NumberInputProps {
  max?: number;
  min?: number;
  step?: number;
  onChange: (value: number) => unknown;
  coerce?: (value: number) => number;
  roundPlaces?: number;
  value: number;
}

export default function NumberInput(props: NumberInputProps) {
  const [savedValue, setSavedValue] = useState<string | number>(props.value);
  const mouseIsDown = useRef<boolean>(false);
  const mouseDownTime = useRef<number>(0);
  const initialHoldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { max, min, roundPlaces, coerce: passedCoerce, onChange: passedOnChange } = props;

  const coerce = usePropRef(passedCoerce);
  const onChange = usePropRef(passedOnChange);

  const performTransformations = useCallback(
    (value: number) => {
      if (max !== undefined && value > max) {
        value = max;
      }
      if (min !== undefined && value < min) {
        value = min;
      }

      if (roundPlaces !== undefined && roundPlaces >= 0) {
        value = parseFloat(value.toFixed(roundPlaces));
        // const pow = Math.pow(10, Math.floor(roundPlaces));
        // return Math.round((value + Number.EPSILON) * pow) / pow;
      }

      if (coerce?.current) {
        value = coerce.current(value);
      }

      return value;
    },
    [coerce, max, min, roundPlaces],
  );

  const emitChange = useCallback(
    (value: number, autoPerformTransformations = true) => {
      if (autoPerformTransformations) {
        value = performTransformations(value);
      }

      if (value !== props.value && onChange.current) {
        onChange.current(value);
      }
    },
    [performTransformations, onChange, props.value],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = parseFloat(e.currentTarget.value);
      if (!isNaN(value)) {
        value = performTransformations(value);
        emitChange(value, false);
        setSavedValue(value);
      } else {
        setSavedValue(e.currentTarget.value);
      }
    },
    [emitChange, performTransformations],
  );

  useEffect(() => {
    setSavedValue(props.value);
  }, [props.value]);

  const increment = useCallback(() => {
    const step = props.step ?? 1;
    let value = props.value;
    const stepDecimals = step.toString().split(".")[1]?.length || 0;
    const valueDecimals = value.toString().split(".")[1]?.length || 0;
    const resultingDecimals = Math.max(stepDecimals, valueDecimals);
    value = parseFloat((props.value + step).toFixed(resultingDecimals));
    if (props.max !== undefined && value > props.max) {
      value = props.max;
    }
    emitChange(value);
  }, [emitChange, props.max, props.step, props.value]);

  const decrement = useCallback(() => {
    const step = props.step ?? 1;
    let value = props.value;
    const stepDecimals = step.toString().split(".")[1]?.length || 0;
    const valueDecimals = value.toString().split(".")[1]?.length || 0;
    const resultingDecimals = Math.max(stepDecimals, valueDecimals);
    value = parseFloat((props.value - step).toFixed(resultingDecimals));
    if (props.min !== undefined && value < props.min) {
      value = props.min;
    }
    emitChange(value);
  }, [emitChange, props.min, props.step, props.value]);

  const handleMouseDown = useCallback(
    (sign: 1 | -1) => {
      const fn = sign === 1 ? increment : decrement;
      mouseIsDown.current = true;
      fn();
      initialHoldTimeout.current = setTimeout(() => {
        if (!mouseIsDown.current) return;
        holdInterval.current = setInterval(() => {
          if (mouseIsDown.current) {
            fn();
          }
        }, 40);
      }, 360);
    },
    [increment, decrement],
  );

  const handleMouseUp = useCallback(() => {
    mouseIsDown.current = false;
    if (initialHoldTimeout.current !== null) {
      clearTimeout(initialHoldTimeout.current);
      initialHoldTimeout.current = null;
    }
    if (holdInterval.current !== null) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseIsDown.current = false;
    if (initialHoldTimeout.current !== null) {
      clearTimeout(initialHoldTimeout.current);
      initialHoldTimeout.current = null;
    }
    if (holdInterval.current !== null) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  const dragLatch = useRef(false);
  const onDrag = useCallback(
    (position: Point, _: Point, og: Point, offset: Point) => {
      const notch = 8;
      const latch = 8;

      if (Math.abs(offset.y) > latch) {
        dragLatch.current = true;
      }

      if (!dragLatch.current) return;

      const initialValue = og.y;
      const delta = offset.y / notch;

      const newValue = performTransformations(initialValue - delta);
      emitChange(newValue, false);
      setSavedValue(newValue);
    },
    [performTransformations, emitChange, setSavedValue],
  );

  const { dragging, startDragging } = useDrag(onDrag);

  useEventListener(
    inputRef,
    "pointerdown",
    useCallback(
      (e) => {
        startDragging(e, { x: props.value, y: props.value });
        dragLatch.current = false;
      },
      [props.value, startDragging],
    ),
  );

  useEventListener(inputRef, "touchstart", preventDefault);

  useEventListener(inputRef, "touchend", (e) => {
    e.preventDefault();
    if (!dragLatch.current) {
      inputRef.current?.focus();
    }
  });

  return (
    <div className="numberInput-container">
      <input
        ref={inputRef}
        className="numberInput"
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={handleChange}
        value={savedValue}
      />
      <div className="numberInput-buttons">
        <button
          className="numberInput-up"
          // onClick={increment}
          onMouseDown={() => handleMouseDown(1)}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          ▲
        </button>
        <button
          className="numberInput-down"
          // onClick={decrement}
          onMouseDown={() => handleMouseDown(-1)}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
