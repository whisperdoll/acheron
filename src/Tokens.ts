import {
  ControlDataTypes,
  ControlState,
  SelectOption,
  TokenDefinition,
  Token,
  TokenCallbacks,
  copyControl,
  TokenUID,
} from "./Types";
import { buildFromDefs } from "./utils/DefaultDefinitions";
import { v4 as uuidv4 } from "uuid";
import * as fs from "@tauri-apps/plugin-fs";
import * as npath from "@tauri-apps/api/path";
import { emptyFn } from "./utils/utils";

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
  AbsorbToken,
  GenerateToken,
  LifespanToken,
  NoteToken,
  RandomizeToken,
  ReboundToken,
  SkipToken,
  SplitToken,
  TwistToken,
  WormholeToken,
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

export async function loadTokenFromPath(
  path: string,
  failSilently: boolean = false
): Promise<{ tokenDef: TokenDefinition; callbacks: TokenCallbacks } | null> {
  let fileContents: string;
  const filePath = await npath.join(path, "script.js");

  try {
    fileContents = await fs.readTextFile(filePath);
  } catch (e) {
    if (!failSilently) reportError(path, "Unable to read file");
    return null;
  }

  const firstLine = fileContents.split("\n")[0];

  if (
    firstLine.length < 19 ||
    firstLine.substr(0, 18) !== "/// acheron.token "
  ) {
    if (!failSilently) reportError(path, "Invalid header");
    return null;
  }

  let version = firstLine.substr(19);

  if (version === "1") {
    return await loadV1(path, fileContents, failSilently);
  } else {
    alert("Unknown token version");
    return null;
  }
}

async function loadV1(
  path: string,
  fileContents: string,
  failSilently: boolean
): Promise<{ tokenDef: TokenDefinition; callbacks: TokenCallbacks } | null> {
  path = await npath.normalize(path);

  const functionsIndex = fileContents.indexOf("/// token.functions");

  if (functionsIndex === -1) {
    if (!failSilently) reportError(path, "Missing functions header");
    return null;
  }

  let tokenJsonText = fileContents.substr(fileContents.indexOf("\n"));
  tokenJsonText = tokenJsonText
    .substr(0, tokenJsonText.indexOf("/// token.functions"))
    .trim();
  let tokenJsonObj: TokenDefinition;

  try {
    tokenJsonObj = JSON.parse(tokenJsonText);
  } catch (e: any) {
    if (!failSilently) reportError(path, e.message);
    return null;
  }

  const badDataTypes = Object.entries(tokenJsonObj.controls).filter(
    (e) => e[1].type && !ControlDataTypes.includes(e[1].type)
  );
  if (badDataTypes.length > 0) {
    badDataTypes.forEach(
      (e) =>
        !failSilently &&
        reportError(
          path,
          `Invalid data type '${e[1].type!}' on token '${
            tokenJsonObj.label
          }' control '${e[0]}'`
        )
    );
    return null;
  }

  try {
    const callbacks: TokenCallbacks = {
      onStart: emptyFn,
      onStop: emptyFn,
      onTick: emptyFn,
    };

    return {
      callbacks,
      tokenDef: Object.freeze(tokenJsonObj),
    };
  } catch (e: any) {
    if (!failSilently)
      reportError(path, "Could not load functions:\n" + e.message);
    return null;
  }
}

export async function getTokenUIDFromPath(
  path: string
): Promise<TokenUID | null> {
  const token = await loadTokenFromPath(path, true);
  if (!token || !Object.prototype.hasOwnProperty.call(token.tokenDef, "uid"))
    return null;

  return token.tokenDef.uid;
}
