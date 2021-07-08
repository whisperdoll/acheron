import * as fs from "fs";
import * as vm from "vm";    
import { ControlDataTypes, ControlState, SelectOption, TokenDefinition, Token, TokenCallbacks, SerializedCompositionToken, copyControl } from "./Types";
import { buildFromDefs } from "./utils/DefaultDefinitions";
import * as npath from "path";
import { AppState, LayerState } from "./AppContext";
import { array_copy } from "./utils/utils";
import { v4 as uuidv4 } from 'uuid';

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

export function buildToken(appState: AppState, path: string)
{
    const def = appState.tokenDefinitions[path];
    const controls = buildFromDefs(def.controls);

    const tokenState = {
        label: def.label,
        symbol: def.symbol,
        id: uuidv4(),
        controlIds: Object.keys(controls),
        store: {},
        callbacks: {...appState.tokenCallbacks[path]!},
        path
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

export function loadToken(path: string): { tokenDef: TokenDefinition, callbacks: TokenCallbacks } | null
{
    let fileContents: string;
    const filePath = npath.join(path, "script.js");

    try
    {
        fileContents = fs.readFileSync(filePath, "utf8");
    }
    catch (e)
    {
        reportError(path, "Unable to read file");
        return null;
    }

    const firstLine = fileContents.split("\n")[0];

    if (firstLine.length < 19 || firstLine.substr(0, 18) !== "/// acheron.token ")
    {
        reportError(path, "Invalid header");
        return null;
    }

    let version = firstLine.substr(19);

    if (version === "1")
    {
        return loadV1(path, fileContents);
    }
    else
    {
        alert("Unknown token version");
        return null;
    }
}

function loadV1(path: string, fileContents: string): { tokenDef: TokenDefinition, callbacks: TokenCallbacks } | null
{
    path = npath.normalize(path);

    const functionsIndex = fileContents.indexOf("/// token.functions");

    if (functionsIndex === -1)
    {
        reportError(path, "Missing functions header");
        return null;
    }

    let tokenJsonText = fileContents.substr(fileContents.indexOf("\n"));
    tokenJsonText = tokenJsonText.substr(0, tokenJsonText.indexOf("/// token.functions")).trim();
    let tokenJsonObj: TokenDefinition;

    try
    {
        tokenJsonObj = JSON.parse(tokenJsonText);
    }
    catch (e)
    {
        reportError(path, e.message);
        return null;
    }

    const badDataTypes = Object.entries(tokenJsonObj.controls).filter(e => e[1].type && !ControlDataTypes.includes(e[1].type));
    if (badDataTypes.length > 0)
    {
        badDataTypes.forEach(e => reportError(path, `Invalid data type '${e[1].type!}' on token '${tokenJsonObj.label}' control '${e[0]}'`));
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
        reportError(path, "Could not load functions:\n" + e.message);
        return null;
    }
}