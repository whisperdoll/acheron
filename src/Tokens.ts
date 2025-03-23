import {
  ControlState,
  SelectOption,
  TokenDefinition,
  Token,
  copyControl,
} from "./Types";
import { buildFromDefs } from "./utils/DefaultDefinitions";
import { v4 as uuidv4 } from "uuid";

import AbsorbToken from "./tokens/absorb.ts";
import GenerateToken from "./tokens/generate.ts";
import LifespanToken from "./tokens/lifespan.ts";
import NoteToken from "./tokens/note.ts";
import RandomizeToken from "./tokens/randomize.ts";
import ReboundToken from "./tokens/rebound.ts";
import SkipToken from "./tokens/skip.ts";
import SplitToken from "./tokens/split.ts";
import TwistToken from "./tokens/twist.ts";
import WormholeToken from "./tokens/wormhole.ts";
import { AppState } from "./state/AppState.ts";

export const tokenDefinitions: TokenDefinition[] = [
  GenerateToken,
  NoteToken,
  RandomizeToken,
  ReboundToken,
  SplitToken,
  SkipToken,
  TwistToken,
  WormholeToken,
  AbsorbToken,
  LifespanToken,
] as TokenDefinition[];

function compareOptions(o1?: SelectOption[], o2?: SelectOption[]) {
  if (!o1) return !o2;
  if (!o2) return !o1;
  if (o1.length !== o2.length) return false;

  return o1.map((o, i) => {
    return o.value === o2[i].value;
  });
}

function compareDataDefinitions(d1: ControlState, d2: ControlState) {
  return (
    d1.type === d2.type &&
    d1.min === d2.min &&
    d1.max === d2.max &&
    d1.inherit === d2.inherit &&
    compareOptions(d1.options, d2.options)
  );
}

function reportError(path: string, msg: string) {
  alert(`There was an error loading the token found at ${path}\n\n${msg}`);
}

export function buildToken(appState: AppState, uid: string) {
  console.log(appState, uid);
  const def = appState.tokenDefinitions[uid];
  const controls = buildFromDefs(def.controls);

  const tokenState: Token = {
    label: def.label,
    symbol: def.symbol,
    id: uuidv4(),
    controlIds: Object.keys(controls),
    controls: def.controls,
    store: {},
    callbacks: { ...appState.tokenDefinitions[uid]!.callbacks },
    uid,
  };

  return { tokenState, controls };
}

export function copyToken(
  appState: AppState,
  token: Token
): { tokenState: Token; controls: Record<string, ControlState> } {
  const controls: Record<string, ControlState> = {};

  token.controlIds.forEach((cid) => {
    const copied = copyControl(appState.controls[cid]);
    controls[copied.id] = copied;
  });

  const tokenState: Token = {
    ...token,
    id: uuidv4(),
    controlIds: Object.keys(controls),
  };

  return { tokenState, controls };
}
