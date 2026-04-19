import {
  ControlState,
  SelectOption,
  TokenDefinition,
  Token,
  copyControl,
  ModChain,
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
import List from "./lib/list.ts";
import ShiftToken from "./tokens/shift.ts";

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
  ShiftToken,
] as TokenDefinition[];

export const tokenDefinitionsMap = List.indexBy(tokenDefinitions, (d) => d.uid);

export function buildToken(appState: AppState, uid: string) {
  // console.log(appState, uid);
  const def = appState.tokenDefinitions[uid];
  const [controls, modChains] = buildFromDefs(def.controls);

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

  return { tokenState, controls, modChains };
}

export function copyToken(
  appState: AppState,
  token: Token,
): {
  tokenState: Token;
  controls: Record<string, ControlState>;
  modChains: Record<string, ModChain>;
} {
  const controls: Record<string, ControlState> = {};
  const modChains: Record<string, ModChain> = {};

  token.controlIds.forEach((cid) => {
    const copied = copyControl(appState.controls[cid]);
    controls[copied.id] = copied;
    modChains[copied.id] = {
      ...appState.modChains[cid],
      input: copied.id,
    };
  });

  const tokenState: Token = {
    ...token,
    id: uuidv4(),
    controlIds: Object.keys(controls),
  };

  return { tokenState, controls, modChains };
}
