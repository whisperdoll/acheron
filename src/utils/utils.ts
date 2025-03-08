import * as path from "@tauri-apps/api/path";
import { ask } from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";

export async function confirmPrompt(
  prompt: string,
  title: string
): Promise<boolean> {
  return await ask(prompt, {
    title,
    kind: "info",
  });
}

export function msToS(ms: number): number {
  return ms / 1000;
}

export type SortFunction<T> = (a: T, b: T) => boolean;

export function isFileNotFoundError(err: NodeJS.ErrnoException): boolean {
  return err.code === "ENOENT";
}

export function mod(x: number, m: number): number {
  if (x >= 0) {
    return x % m;
  } else {
    return (m - (-x % m)) % m;
  }
}

export function objectWithoutKeys<
  K extends string | number | symbol,
  T extends Record<K, any>
>(o: T, keys: K[]): Omit<typeof o, (typeof keys)[number]> {
  const ret = { ...o };
  keys.forEach((key) => delete ret[key]);
  return ret;
}

export function sliceObject<
  T extends Record<string | number | symbol, any>,
  K extends keyof T
>(o: T, keys: K[]): Pick<typeof o, (typeof keys)[number]> {
  const ret = {} as Record<K, any>;
  keys.forEach((key) => (ret[key] = o[key]));
  return ret;
}

export function pluck<T, K extends (keyof T)[]>(
  obj: T,
  keys: [...K]
): { [I in keyof K]: T[K[I]] } {
  return keys.map((key) => obj[key]) as { [I in keyof K]: T[K[I]] };
}

export async function makeUserDataPath() {
  try {
    await fs.mkdir(await getUserDataPath());
  } catch {
    // already exists
  }
}

export async function getUserDataPath(): Promise<string> {
  const upath = await path.dataDir();
  return path.join(upath, "acheron/");
}

export function emptyFn() {}

export function array_remove<T>(
  array: T[],
  item: T
): { item: T; index: number; existed: boolean } {
  let index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
    return { item, index, existed: true };
  }

  return { item, index: -1, existed: false };
}

export function array_copy<T>(array: T[]): T[] {
  return array.slice();
}

export function createEmpty2dArray(len: number) {
  const ret = [];

  for (let i = 0; i < len; i++) {
    ret.push([]);
  }

  return ret;
}

export function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.substr(1);
}

export function p(arg: any, label?: string) {
  console.log(...(label ? [label, arg] : [arg]));
  return arg;
}
