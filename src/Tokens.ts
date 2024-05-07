import * as fs from "fs";
import * as vm from "vm";    
import { ControlDataTypes, ControlState, SelectOption, TokenDefinition, Token, TokenCallbacks, copyControl, TokenUID } from "./Types";
import { buildFromDefs } from "./utils/DefaultDefinitions";
import * as npath from "path";
import { AppState, LayerState } from "./AppContext";
import { array_copy, isFileNotFoundError, p } from "./utils/utils";
import { v4 as uuidv4 } from 'uuid';
const remote = require('@electron/remote');

function compareOptions(o1?: SelectOption[], o2?: SelectOption[])
{
    if (!o1) return !o2;
    if (!o2) return !o1;
    if (o1.length !== o2.length) return false;

    return o1.map((o, i) =>
    {
        return o.value === o2[i].value;
    });
}

function compareDataDefinitions(d1: ControlState, d2: ControlState)
{
    return d1.type === d2.type &&
        d1.min === d2.min &&
        d1.max === d2.max &&
        d1.inherit === d2.inherit &&
        compareOptions(d1.options, d2.options);
}

function reportError(path: string, msg: string)
{
    alert(`There was an error loading the token found at ${path}\n\n${msg}`);
}

export function buildToken(appState: AppState, uid: string)
{
    const def = appState.tokenDefinitions[uid];
    const controls = buildFromDefs(def.controls);

    const tokenState : Token = {
        label: def.label,
        symbol: def.symbol,
        id: uuidv4(),
        controlIds: Object.keys(controls),
        store: {},
        callbacks: {...appState.tokenCallbacks[uid]!},
        uid
    };

    return { tokenState, controls };
}

export function copyToken(appState: AppState, token: Token): { tokenState: Token, controls: Record<string, ControlState> }
{
    const controls: Record<string, ControlState> = {};

    token.controlIds.forEach((cid) =>
    {
        const copied = copyControl(appState.controls[cid]);
        controls[copied.id] = copied;
    });

    const tokenState: Token = {
        ...token,
        id: uuidv4(),
        controlIds: Object.keys(controls)
    };

    return { tokenState, controls };
}

export function getTokenUIDFromPath(path: string): TokenUID | null
{
    const token = loadTokenFromPath(path, true);
    if (!token || !Object.prototype.hasOwnProperty.call(token.tokenDef, "uid")) return null;

    return token.tokenDef.uid;
}

export function loadTokensFromSearchPaths(paths: string[]): { tokens: Record<TokenUID, { tokenDef: TokenDefinition, callbacks: TokenCallbacks }>, failed: string[] }
{
    const badPaths: string[] = [];
    const ret: Record<TokenUID, { tokenDef: TokenDefinition, callbacks: TokenCallbacks }> = {};

    const tryReadDir = (path: string) => {
        try {
            return fs.readdirSync(path, { withFileTypes: true });
        } catch(e) {
            if (!isFileNotFoundError(e)) {
                console.error(e);
            }

            return false;
        }
    };

    paths.forEach((path) =>
    {
        let candidates = tryReadDir(path);
        if (!candidates) { // this is not based on testing as far as i know, just following legacy code in case it was needed on windows
            badPaths.push(path);
            path = npath.resolve(path);
            candidates = tryReadDir(path);
        }
        if (!candidates) {
            badPaths.push(path);
            path = npath.join(remote.app.getAppPath(), '../../', path);
            candidates = tryReadDir(path);
        }

        if (!candidates) {
            badPaths.push(path);
            return;
        }

        candidates.forEach((candidate) =>
        {
            if (candidate.isDirectory())
            {
                const candidateChildren = fs.readdirSync(npath.join(path, candidate.name), { withFileTypes: true });
                if (candidateChildren.some(child => child.isFile() && child.name === "script.js"))
                {
                    const res = loadTokenFromPath(npath.join(path, candidate.name));
                    if (res)
                    {
                        ret[res.tokenDef.uid] = res;
                    }
                }
            }
        });
    });

    if (badPaths.length > 0)
    {
        alert("The following search directories could not be read from (don't exist):\n\n" + badPaths.join("\n"));
    }

    return {
        failed: [],
        tokens: ret
    };
}

export function loadTokenFromPath(path: string, failSilently: boolean = false): { tokenDef: TokenDefinition, callbacks: TokenCallbacks } | null
{
    let fileContents: string;
    const filePath = npath.join(path, "script.js");

    try
    {
        fileContents = fs.readFileSync(filePath, "utf8");
    }
    catch (e)
    {
        if (!failSilently) reportError(path, "Unable to read file");
        return null;
    }

    const firstLine = fileContents.split("\n")[0];

    if (firstLine.length < 19 || firstLine.substr(0, 18) !== "/// acheron.token ")
    {
        if (!failSilently) reportError(path, "Invalid header");
        return null;
    }

    let version = firstLine.substr(19);

    if (version === "1")
    {
        return loadV1(path, fileContents, failSilently);
    }
    else
    {
        alert("Unknown token version");
        return null;
    }
}

function loadV1(path: string, fileContents: string, failSilently: boolean): { tokenDef: TokenDefinition, callbacks: TokenCallbacks } | null
{
    path = npath.normalize(path);

    const functionsIndex = fileContents.indexOf("/// token.functions");

    if (functionsIndex === -1)
    {
        if (!failSilently) reportError(path, "Missing functions header");
        return null;
    }

    let tokenJsonText = fileContents.substr(fileContents.indexOf("\n"));
    tokenJsonText = tokenJsonText.substr(0, tokenJsonText.indexOf("/// token.functions")).trim();
    let tokenJsonObj: TokenDefinition;

    try
    {
        tokenJsonObj = JSON.parse(tokenJsonText);
        tokenJsonObj.path = path;
    }
    catch (e)
    {
        if (!failSilently) reportError(path, e.message);
        return null;
    }

    const badDataTypes = Object.entries(tokenJsonObj.controls).filter(e => e[1].type && !ControlDataTypes.includes(e[1].type));
    if (badDataTypes.length > 0)
    {
        badDataTypes.forEach(e => !failSilently && reportError(path, `Invalid data type '${e[1].type!}' on token '${tokenJsonObj.label}' control '${e[0]}'`));
        return null;
    }

    try
    {
        let tokenFunctionsText = fileContents.substr(functionsIndex + 19).trim();

        const script = new vm.Script(tokenFunctionsText);
        const scriptContext = vm.createContext();
        script.runInContext(scriptContext);

        const callbacks: TokenCallbacks = {
            onStart: scriptContext.onStart,
            onStop: scriptContext.onStop,
            onTick: scriptContext.onTick
        };

        return {
            callbacks,
            tokenDef: Object.freeze(tokenJsonObj)
        };
    }
    catch (e)
    {
        if (!failSilently) reportError(path, "Could not load functions:\n" + e.message);
        return null;
    }
}