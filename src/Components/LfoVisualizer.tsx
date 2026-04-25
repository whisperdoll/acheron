import React, { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { getLfoValue, Lfo, LfoConnectableProperty } from "../Types";
import Point from "../utils/point";
import { clamp, minAndMax } from "../lib/utils";
import { AppContext, resolveModItem } from "../state/AppState";

interface Props {
  lfo: Lfo;
  currentTimeMs: number;
  resolutionX: number;
  resolutionY: number;
  modItemId: string;
}

export default React.memo(function LfoVisualizer({
  lfo: baseLfo,
  currentTimeMs,
  resolutionX,
  resolutionY,
  modItemId,
}: Props) {
  const { state, setState } = useContext(AppContext)!;

  const modChain = state.modChainControl ? state.modChains[state.modChainControl] : null;
  const now = Math.round(currentTimeMs / 20);

  const inputValues = useMemo(() => {
    const ret: Partial<Record<LfoConnectableProperty, number>> = {};

    if (!modItemId || !modChain) return ret;

    modChain.connections.forEach((connection) => {
      if (connection.to === modItemId) {
        ret[connection.toProperty as LfoConnectableProperty] = resolveModItem(
          state,
          state.modChainControl!,
          connection.from,
          connection.fromOutput,
        );
      }
    });

    return ret;
  }, [baseLfo, modItemId, modChain, now]);

  const lfo: Lfo = useMemo(() => ({ ...baseLfo, ...inputValues }), [baseLfo, inputValues]);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement>(null);
  const periodMs = (lfo.type === "square" ? lfo.hiPeriod + lfo.lowPeriod : lfo.period) * 1000;
  const animHandle = useRef<number>(0);

  useEffect(() => {
    const ctx = waveCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    const resolution = periodMs / 10;
    const min = Math.min(lfo.min, lfo.max);
    const max = Math.max(lfo.min, lfo.max);
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
          resolutionY - ctx.lineWidth,
        ),
      );
    }

    ctx.stroke();
  }, [lfo, resolutionX, resolutionY]);

  const clearTime = useCallback(() => {
    const ctx = progressCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, resolutionX, resolutionY);
  }, []);

  const drawTime = useCallback(() => {
    const ctx = progressCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    const pNow = performance.now();
    const delta = pNow - state.startTime;

    const pc = (delta % periodMs) / periodMs;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#FF0000";
    ctx.beginPath();
    ctx.moveTo(pc * resolutionX, 0);
    ctx.lineTo(pc * resolutionX, resolutionY);
    ctx.stroke();

    const min = Math.min(lfo.min, lfo.max);
    const max = Math.max(lfo.min, lfo.max);
    const amp = max - min;

    const value = getLfoValue(lfo, { beat: 0, ms: pc * periodMs }, "ms");

    const y = resolutionY - ((value - min) / amp) * resolutionY;

    ctx.stroke();

    ctx.fillStyle = "#ffe96f";
    ctx.beginPath();
    ctx.arc(pc * resolutionX, y, 5, 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

  useEffect(() => {
    clearTime();

    if (!state.isPlaying) {
      return;
    }

    drawTime();
  }, [state.isPlaying, resolutionX, resolutionY, lfo, now]);

  return (
    <div className="lfoVisualizer">
      <canvas ref={waveCanvasRef} width={resolutionX} height={resolutionY}></canvas>
      <canvas ref={progressCanvasRef} width={resolutionX} height={resolutionY}></canvas>
    </div>
  );
});
