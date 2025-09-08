import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, midpoint, mod, randomFloat } from "../lib/utils";
import "./Synth.scss";
import Knob from "./Knob";

const waveShapes = [
  "sin",
  "triangle",
  "pulse",
  "sawtooth",
  "noise",
  "custom",
] as const;
type WaveShape = (typeof waveShapes)[number];
const CANVAS_RESOLUTION = { width: 300, height: 150 };

interface Props {}

export default function Synth(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveShape, setWaveShape] = useState<WaveShape>("pulse");
  const [resolution, setResolution] = useState<number>(CANVAS_RESOLUTION.width);
  const [pulseOpts, setPulseOpts] = useState<PulseOptions>({ edgePc: 0.5 });
  const [customOpts, setCustomOpts] = useState<CustomOptions>({
    formula: "Math.sin(pc * 2 * Math.PI)",
  });
  const [error, setError] = useState<string | null>(null);

  const drawWave = useCallback(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_RESOLUTION.width, CANVAS_RESOLUTION.height);
    ctx.strokeStyle = "green";
    ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
    ctx.beginPath();

    const midPoint = CANVAS_RESOLUTION.height / 2;
    const halfHeight = midPoint - ctx.lineWidth;

    ctx.moveTo(0, midPoint);

    try {
      for (let i = 0; i < resolution; i++) {
        const pc = i / resolution;
        const value = waveValue(
          waveShape,
          pc,
          waveShape === "pulse"
            ? pulseOpts
            : waveShape === "custom"
            ? customOpts
            : undefined
        );

        ctx[i === 0 ? "lineTo" : "lineTo"](
          pc * CANVAS_RESOLUTION.width,
          midPoint - value * halfHeight
        );
      }

      ctx.lineTo(CANVAS_RESOLUTION.width, midPoint);

      ctx.stroke();
      ctx.fill();
      setError(null);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.toString());
      }
    }
  }, [waveShape, canvasRef, pulseOpts, customOpts, resolution]);

  useEffect(() => {
    drawWave();
  }, [drawWave]);

  return (
    <div className="Synth">
      <canvas ref={canvasRef} {...CANVAS_RESOLUTION}></canvas>
      <div className="controls">
        <label>
          <div>Wave Type:</div>
          <select
            value={waveShape}
            onChange={(e) => setWaveShape(e.currentTarget.value as WaveShape)}
          >
            {waveShapes.map((ws) => {
              return <option value={ws}>{ws}</option>;
            })}
          </select>
        </label>
        {waveShape === "pulse" && (
          <label>
            <div>Edge:</div>
            <Knob
              value={pulseOpts.edgePc}
              onChange={(v) => setPulseOpts((prev) => ({ ...prev, edgePc: v }))}
              step={0.1}
              min={0}
              max={1}
              knobSpeed={4}
            />
          </label>
        )}
        {waveShape === "custom" && (
          <label>
            <div>Formula:</div>
            <input
              type="text"
              value={customOpts.formula}
              onChange={(e) =>
                setCustomOpts((prev) => ({
                  ...prev,
                  formula: e.target.value,
                }))
              }
            ></input>
          </label>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

type PulseOptions = { edgePc: number };
type CustomOptions = { formula: string };

function waveValue(
  waveShape: WaveShape,
  pc: number,
  opts: undefined | PulseOptions | CustomOptions
): number {
  switch (waveShape) {
    case "noise": {
      return randomFloat() * 2 - 1;
    }
    case "sawtooth": {
      return pc * 2 - 1;
    }
    case "triangle": {
      return 4 * Math.abs(mod(pc - 0.25, 1) - 0.5) - 1;
    }
    case "sin": {
      return Math.sin(pc * 2 * Math.PI);
    }
    case "pulse": {
      return pc < (opts as PulseOptions).edgePc ? -1 : 1;
    }
    case "custom": {
      return eval(`pc = ${pc}; ${(opts as CustomOptions).formula}`);
    }
    default: {
      throw "lfo error";
    }
  }
}
