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

import AbsorbToken from "./tokens/absorb.tsx";
import GenerateToken from "./tokens/generate.tsx";
import LifespanToken from "./tokens/lifespan.tsx";
import NoteToken from "./tokens/note.tsx";
import RandomizeToken from "./tokens/randomize.tsx";
import ReboundToken from "./tokens/rebound.tsx";
import SkipToken from "./tokens/skip.tsx";
import SplitToken from "./tokens/split.tsx";
import TwistToken from "./tokens/twist.tsx";
import WormholeToken from "./tokens/wormhole.tsx";
import ShiftToken from "./tokens/shift.tsx";
import { AppState } from "./state/AppState.tsx";
import List from "./lib/list.ts";

export const tokenDefinitions: TokenDefinition[] = [
  GenerateToken,
  NoteToken,
  ReboundToken,
  TwistToken,
  SkipToken,
  ShiftToken,
  AbsorbToken,
  LifespanToken,
  SplitToken,
  WormholeToken,
  RandomizeToken,

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
