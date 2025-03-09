import React, { useEffect, useMemo, useRef } from "react";
import { getLfoValue, Lfo } from "../Types";
import Point from "../utils/point";
import { clamp, minAndMax } from "../lib/utils";

interface Props {
  lfo: Lfo;
  currentTimeMs: number;
  resolutionX: number;
  resolutionY: number;
}

export default React.memo(function LfoVisualizer({
  lfo,
  currentTimeMs,
  resolutionX,
  resolutionY,
}: Props) {
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement>(null);
  const periodMs =
    (lfo.type === "square" ? lfo.hiPeriod + lfo.lowPeriod : lfo.period) * 1000;

  useEffect(() => {
    const ctx = waveCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    if (lfo.type === "sequence" && !lfo.sequence.length) return;

    const resolution = periodMs / 10;
    const [min, max] =
      lfo.type === "sequence" ? minAndMax(lfo.sequence) : [lfo.min, lfo.max];
    const amp = max - min;

    ctx.lineWidth = 2;

    ctx.clearRect(0, 0, resolutionX, resolutionY);
    ctx.beginPath();
    ctx.strokeStyle = "#AAAAAA";
    ctx.moveTo(0, resolutionY / 2);
    ctx.lineTo(resolutionX, resolutionY / 2);
    for (let i = 0; i < 4; i++) {
      ctx.moveTo((resolutionX / 4) * i, 0);
      ctx.lineTo((resolutionX / 4) * i, resolutionY);
    }
    ctx.stroke();

    ctx.strokeStyle = "#00FF00";
    ctx.beginPath();

    for (let i = 0; i <= resolution; i++) {
      const pc = Math.min(i / resolution, 0.99);
      const value = getLfoValue(lfo, { beat: 0, ms: pc * periodMs }, "ms");

      ctx[i === 0 ? "moveTo" : "lineTo"](
        pc * resolutionX,
        clamp(
          resolutionY - ((value - min) / amp) * resolutionY,
          ctx.lineWidth,
          resolutionY - ctx.lineWidth
        )
      );
    }

    ctx.stroke();
  }, [lfo, resolutionX, resolutionY]);

  useEffect(() => {
    const ctx = progressCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, resolutionX, resolutionY);

    if (!currentTimeMs) {
      return;
    }

    const pc = (currentTimeMs % periodMs) / periodMs;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#FF0000";
    ctx.beginPath();
    ctx.moveTo(pc * resolutionX, 0);
    ctx.lineTo(pc * resolutionX, resolutionY);
    ctx.stroke();
  }, [currentTimeMs, resolutionX, resolutionY]);

  return (
    <div className="lfoVisualizer">
      <canvas
        ref={waveCanvasRef}
        width={resolutionX}
        height={resolutionY}
      ></canvas>
      <canvas
        ref={progressCanvasRef}
        width={resolutionX}
        height={resolutionY}
      ></canvas>
    </div>
  );
});
