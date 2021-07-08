import { AppState } from "./AppContext";
import { BooleanControlState, buildBooleanControl, buildEnumControl, buildControl, ControlState, EnumControlState, ControlState, ControlType, pulseEverySettings, timeToLiveSettings } from "./Types";

export const TokenTypes = [
    "generate",
    "note",
    "rebound",
    "absorb",
    "split",
    "spin",
    "skip"
] as const;

export type TokenType = typeof TokenTypes[number];

export interface Token
{
    type: TokenType;
    enabled: boolean;
    controls: (ControlState<any>)[];
}

export function buildToken(type: TokenType, state: AppState): Token
{
    switch (type)
    {
        case "generate":
            return {
                enabled: true,
                type: "generate",
                controls: [
                    buildEnumControl("triggerMode", "Trigger Mode", ["beat","impact","midi"] as const, "midi"),
                    buildControl("probability", "scalar", false),
                    buildControl("direction", "scalar", false),
                    buildControl("timeToLive", "inherit", true, (state) => state.timeToLive),
                    buildControl("pulseEvery", "inherit", true, (state) => state.pulseEvery),
                    buildControl("offset", "scalar", false)
                ]
            };
        case "note":
            return {
                enabled: true,
                type: "note",
                controls: [
                    buildControl("emphasis", "scalar", false),
                    buildControl("gate", "scalar", false),
                    buildControl("ghostBeats", "scalar", false),
                    buildControl("noteLength", "scalar", false),
                    buildControl("probability", "scalar", false),
                    buildControl("velocity", "scalar", false),
                    buildBooleanControl("midiOverride", "MIDI override", false),
                    // TODO: triad
                ]
            };
        case "rebound":
            return {
                enabled: true,
                type: "rebound",
                controls: [
                    buildControl("direction", "scalar", false),
                    buildControl("gate", "scalar", false),
                    buildControl("probability", "scalar", false)
                ]
            };
        case "absorb":
            return {
                enabled: true,
                type: "absorb",
                controls: [
                    buildControl("gate", "scalar", false),
                    buildControl("probability", "scalar", false)
                ]
            };
        case "split":
            return {
                enabled: true,
                type: "split",
                controls: [
                    buildBooleanControl("bounceback", "Bounceback", false),
                    buildControl("gate", "scalar", false),
                    buildControl("probability", "scalar", false)
                ]
            };
        case "spin":
            return {
                enabled: true,
                type: "spin",
                controls: [
                    buildBooleanControl("clockwise", "Clockwise", false),
                    buildControl("gate", "scalar", false),
                    buildControl("probability", "scalar", false),
                    buildControl("stepping", "scalar", false)
                ]
            };
        case "skip":
            return {
                enabled: true,
                type: "skip",
                controls: [
                    buildControl("gate", "scalar", false),
                    buildControl("probability", "scalar", false),
                    buildControl("stepping", "scalar", false)
                ]
            };
    }
}