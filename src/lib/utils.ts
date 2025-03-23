import prand from "pure-rand";
import { type MutableRefObject, type RefCallback } from "react";

export type Nullish = null | undefined;
export function isNullish(value: any): value is Nullish {
  return value === null || value === undefined;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function splitmix32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

export function clamp(n: number, min: number, max: number): number {
  return n > max ? max : n < min ? min : n;
}

export function minAndMax(arr: number[]): [number, number] {
  if (arr.length === 0) throw "bad array";

  let min, max;
  min = max = arr[0];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < min) {
      min = arr[i];
    }
    if (arr[i] > max) {
      max = arr[i];
    }
  }

  return [min, max];
}

export function mod(x: number, m: number): number {
  if (x >= 0) {
    return x % m;
  } else {
    return (m - (-x % m)) % m;
  }
}

export const isFunction = (x: unknown) => typeof x === "function";
export const isNullOrUndefined = (x: unknown) => x === undefined || x === null;
export const isPromise = <T = unknown>(x: unknown): x is Promise<T> =>
  !!x &&
  (typeof x === "object" || typeof x === "function") &&
  "then" in x &&
  typeof x.then === "function";

export const tryParseInt = (value: number | string, fallback: number) => {
  const parsed = parseInt(value as string);
  return isNaN(parsed) ? fallback : parsed;
};

export const normalizeIndex = (i: number, array: any[]) =>
  i >= 0 ? i : array.length + i;

export type MaybeGenerated<
  ReturnType,
  GeneratorArgsType extends Array<any> = []
> = ReturnType | ((...prev: GeneratorArgsType) => ReturnType);

export const resolveMaybeGenerated = <
  ReturnType,
  GeneratorArgsType extends Array<any> = [ReturnType]
>(
  action: MaybeGenerated<ReturnType, GeneratorArgsType>,
  ...generatorArgs: GeneratorArgsType
) => (isFunction(action) ? action(...generatorArgs) : action);

export type MaybePromise<T> = T | Promise<T>;

export async function resolveMaybePromise<T>(
  value: T | Promise<T>
): Promise<T> {
  return await Promise.resolve(value);
}

export type MaybeGeneratedPromise<
  ReturnType,
  GeneratorArgsType extends Array<any> = [ReturnType]
> = MaybeGenerated<MaybePromise<ReturnType>, GeneratorArgsType>;

export async function resolveMaybeGeneratedPromise<
  ReturnType,
  GeneratorArgsType extends Array<any> = [ReturnType]
>(
  value: MaybeGeneratedPromise<ReturnType, GeneratorArgsType>,
  ...generatorArgs: GeneratorArgsType
): Promise<ReturnType> {
  return await resolveMaybePromise(
    await resolveMaybeGenerated(value, ...generatorArgs)
  );
}

let randomFloatRng = prand.xoroshiro128plus(performance.now());
export function randomFloat(): number {
  const resolution = 1 << 24;

  const ret =
    prand.unsafeUniformIntDistribution(0, resolution - 1, randomFloatRng) /
    resolution;

  // randomFloatRng.next();

  return ret;
}

export function distance(p1: Point, p2: Point): number;
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number;
export function distance(
  x1: number | Point,
  y1: number | Point,
  x2?: number,
  y2?: number
): number {
  if (typeof x1 === "object" && typeof y1 === "object") {
    // x1 and y1 are both Points
    return Math.sqrt((x1.x - y1.x) ** 2 + (x1.y - y1.y) ** 2);
  } else if (
    typeof x1 === "number" &&
    typeof y1 === "number" &&
    typeof x2 === "number" &&
    typeof y2 === "number"
  ) {
    // x1, y1, x2, and y2 are all numbers
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  } else {
    throw new Error("Invalid arguments");
  }
}

export function sum(...nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

export function average(...nums: number[]) {
  return sum(...nums) / nums.length;
}

export function midpoint(...points: Point[]): Point {
  return {
    x: average(...points.map((p) => p.x)),
    y: average(...points.map((p) => p.y)),
  };
}

export function cx(
  ...classes: (string | Record<string, boolean> | undefined | null | false)[]
) {
  const ret: string[] = [];

  classes.forEach((c) => {
    if (!c) return;

    if (typeof c === "string") {
      ret.push(c);
    } else {
      Object.entries(c).forEach(([className, shouldUse]) => {
        if (shouldUse) {
          ret.push(className);
        }
      });
    }
  });

  return ret.join(" ");
}

export function rectContainsPoint(rect: Rect, point: Point) {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  return (
    point.x >= rect.x &&
    point.x <= right &&
    point.y >= rect.y &&
    point.y <= bottom
  );
}

export function pointArray(pt: Point): [number, number] {
  return [pt.x, pt.y];
}

export function rectArray(r: Rect): [number, number, number, number] {
  return [r.x, r.y, r.w, r.h];
}

export function polygonContainsPoint(polygon: Point[], point: Point) {
  const { x, y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

export function inflateRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    w: rect.w + amount * 2,
    h: rect.h + amount * 2,
  };
}

type MutableRefList<T> = Array<
  RefCallback<T> | MutableRefObject<T> | undefined | null
>;

export function mergeRefs<T>(...refs: MutableRefList<T>): RefCallback<T> {
  return (val: T) => {
    setRef(val, ...refs);
  };
}

export function setRef<T>(val: T, ...refs: MutableRefList<T>): void {
  refs.forEach((ref) => {
    if (typeof ref === "function") {
      ref(val);
    } else if (!isNullOrUndefined(ref)) {
      ref.current = val;
    }
  });
}

export function multiplyPt(pt: Point, factor: Point | number): Point {
  if (typeof factor === "number") {
    return { x: pt.x * factor, y: pt.y * factor };
  }

  return { x: pt.x * factor.x, y: pt.y * factor.y };
}

function isRect(r: any): r is Rect {
  return (
    r.x !== undefined &&
    r.y !== undefined &&
    r.h !== undefined &&
    r.w !== undefined
  );
}

export function viewportToDocument(
  point: Point | Rect,
  zoom: number,
  offset: Point
): Point | Rect {
  if (isRect(point)) {
    return {
      x: (point.x - offset.x) / zoom,
      y: (point.y - offset.y) / zoom,
      w: point.w / zoom,
      h: point.h / zoom,
    };
  } else {
    return { x: (point.x - offset.x) / zoom, y: (point.y - offset.y) / zoom };
  }
}

export function documentToViewport<T extends Point | Rect>(
  point: T,
  zoom: number,
  offset: Point
): T {
  if (isRect(point)) {
    return {
      x: point.x * zoom + offset.x,
      y: point.y * zoom + offset.y,
      w: point.w * zoom,
      h: point.h * zoom,
    } as T;
  } else {
    return { x: point.x * zoom + offset.x, y: point.y * zoom + offset.y } as T;
  }
}

export function pointFromEvent(e: { offsetX: number; offsetY: number }): Point {
  return { x: e.offsetX, y: e.offsetY };
}

export function pointFromEventClient(e: {
  clientX: number;
  clientY: number;
}): Point {
  return { x: e.clientX, y: e.clientY };
}

export function getContext<T extends HTMLCanvasElement | OffscreenCanvas>(
  canvas: T
): T extends HTMLCanvasElement
  ? CanvasRenderingContext2D
  : OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw "no context :o";
  return ctx as T extends HTMLCanvasElement
    ? CanvasRenderingContext2D
    : OffscreenCanvasRenderingContext2D;
}

export function rectFromClientBoundingRect(
  rect: ReturnType<Element["getBoundingClientRect"]>
): Rect {
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
}

export function normalize(n: number) {
  return n / Math.abs(n);
}

export const enum PointerEventButton {
  None = 0,
  MouseLeft = 1,
  Touch = 1,
  Pen = 1,
  MouseMiddle = 4,
  MouseRight = 2,
  PenBarrel = 2,
  MouseExtra1 = 8,
  MouseExtra2 = 16,
  PenEraser = 32,
}

export function buttonDown(
  e: PointerEvent,
  ...buttons: PointerEventButton[]
): boolean {
  return !!(e.buttons & buttons.reduce((acc, v) => acc | v, 0));
}

export function wrapArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function arrayWithoutIndexes<T>(array: T[], ...indexes: number[]): T[] {
  const normalizedIndexes = indexes.map((i) => normalizeIndex(i, array));
  const copy = array.slice(0);
  normalizedIndexes.sort((a, b) => b - a).forEach((i) => copy.splice(i, 1));
  return copy;
}

export function arrayWithModifiedIndexes<T, E extends T = T>(
  array: T[],
  indexes: number | number[],
  updateFn: (old: E) => T
): T[] {
  const copy = array.slice(0);
  const normalizedIndexex = wrapArray(indexes).map((i) =>
    normalizeIndex(i, copy)
  );
  for (const i of normalizedIndexex) {
    copy[i] = updateFn(copy[i] as E);
  }
  return copy;
}
