

export interface ControlState<T>
{
    label: string;
    defaultValue: T;
    type: "number" | "boolean" | "string";
    key: string;
    valueTypes: ControlValueType[];
    currentValueType: ControlValueType;
    _value: T;
    getValue: (state: AppState) => T;
    withNewValue: (value: T) => ControlState<T>;
    inheritsFrom: ((state: AppState) => ControlState<T>) | null;
}

export interface ControlState extends ControlState<number>
{
    type: "number";
    min: number;
    max: number;
    step: number;
    isWholeNumber: boolean;
}

export interface BooleanControlState extends ControlState<boolean>
{
    type: "boolean";
}

export interface EnumControlState<A extends readonly string[], T = A[number]> extends ControlState<T>
{
    type: "string";
    options: A;
}

const getValue = function<T>(this: ControlState<T>, state: AppState): T
{
    if (this.currentValueType === "inherit")
    {
        if (!this.inheritsFrom)
        {
            throw "empty inheritsfrom";
        }
        return this.inheritsFrom(state).getValue(state);
    }

    return this._value;
}

const getNumberValue = function(this: ControlState<number>, state: AppState): number
{
    if (this.currentValueType === "inherit")
    {
        if (!this.inheritsFrom)
        {
            throw "empty inheritsfrom";
        }
        return this.inheritsFrom(state).getValue(state);
    }
    else if (this.currentValueType === "lfo")
    {
        return 0; // TODO
    }

    return this._value;
}

const withNewValue = function<T>(this: ControlState<T>, value: T): ControlState<T>
{
    if (this.currentValueType === "scalar")
    {
        return {
            ...this,
            _value: value
        };
    }
    else
    {
        return this;
    }
};

export const PlayerControlTypes = [
    "transpose",
    "tempo",
    "barLength",
    "velocity",
    "emphasis",
    "noteLength",
    "timeToLive",
    "pulseEvery"
] as const;

export type PlayerControlType = typeof PlayerControlTypes[number];

export const LayerControlTypes = [
    "transpose",
    "tempo",
    "barLength",
    "velocity",
    "emphasis",
    "noteLength",
    "timeToLive",
    "pulseEvery"
] as const;
export type LayerControlType = typeof LayerControlTypes[number];

export const GenerateControlTypes = [
    "probability",
    "direction",
    "timeToLive",
    "pulseEvery",
    "offset"
] as const;
export type GenerateControlType = typeof GenerateControlTypes[number];

export const NoteControlTypes = [
    "probability",
    "gate",
    "velocity",
    "emphasis",
    "noteLength",
    "ghostBeats"
] as const;
export type NoteControlType = typeof NoteControlTypes[number];

export const ReboundControlTypes = [
    "probability",
    "gate",
    "direction"
] as const;
export type ReboundControlType = typeof ReboundControlTypes[number];

export const AbsorbControlTypes = [
    "probability",
    "gate"
] as const;
export type AbsorbControlType = typeof AbsorbControlTypes[number];

export const SplitControlTypes = [
    "probability",
    "gate"
] as const;
export type SplitControlType = typeof SplitControlTypes[number];

export const SpinControlTypes = [
    "probability",
    "gate",
    "stepping"
] as const;
export type SpinControlType = typeof SpinControlTypes[number];

export const SkipControlTypes = [
    "probability",
    "gate",
    "skipOver"
] as const;
export type SkipControlType = typeof SkipControlTypes[number];

export type ControlType = 
    | PlayerControlType
    | LayerControlType
    | GenerateControlType
    | NoteControlType
    | AbsorbControlType
    | SplitControlType
    | SpinControlType
    | SkipControlType
;

export function buildBooleanControl(key: string, label: string, defaultValue: boolean): BooleanControlState
{
    return {
        key,
        _value: defaultValue,
        currentValueType: "scalar",
        defaultValue,
        getValue,
        inheritsFrom: null,
        label,
        type: "boolean",
        valueTypes: ["scalar"],
        withNewValue
    };
}

export function buildEnumControl<A extends readonly string[]>(key: string, label: string, options: A, defaultValue: A[number]): EnumControlState<A>
{
    return {
        key,
        _value: defaultValue,
        currentValueType: "scalar",
        defaultValue,
        getValue,
        inheritsFrom: null,
        label,
        type: "string",
        valueTypes: ["scalar"],
        withNewValue,
        options
    };
}

export function buildControl(
    type: ControlType,
    currentValueType: ControlValueType,
    canInherit: boolean,
    inheritsFrom?: ((state: AppState) => ControlState)
): ControlState
{
    // NOTE: values get set to 0 initially then set to defaults later for DRY purposes //

    const builder: {[key in ControlType]: ControlState} = ({
        "transpose": {
            key: type,
            label: "Transpose",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0,
            min: 0,
            max: 100,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "tempo": {
            key: type,
            label: "Tempo",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 120,
            min: 1,
            max: 300,
            step: 1,
            isWholeNumber: false,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "barLength": {
            key: type,
            label: "Bar Length",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 4,
            min: 1,
            max: 12,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "velocity": {
            key: type,
            label: "Velocity",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 90,
            min: 0,
            max: 127,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "emphasis": {
            key: type,
            label: "Emphasis",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 120,
            min: 1,
            max: 200,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "noteLength": {
            key: type,
            label: "Note Length",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0.6,
            min: 0.1,
            max: 10,
            step: 0.1,
            isWholeNumber: false,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "timeToLive": {
            key: type,
            label: "Time to Live",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 16,
            min: 1,
            max: 64,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "pulseEvery": {
            key: type,
            label: "Pulse Every",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 16,
            min: 1,
            max: 64,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "probability": {
            key: type,
            label: "Probability",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 100,
            min: 0,
            max: 100,
            step: 1,
            isWholeNumber: false,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "direction": {
            key: type,
            label: "Direction",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0,
            min: 0,
            max: 6,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "offset": {
            key: type,
            label: "Offset",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0,
            min: 0,
            max: 64,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "gate": {
            key: type,
            label: "Gate",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0,
            min: 0,
            max: 32,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "ghostBeats": {
            key: type,
            label: "Ghost Beats",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0,
            min: 0,
            max: 16,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "stepping": {
            key: type,
            label: "Stepping",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 1,
            min: 0,
            max: 5,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        },
        "skipOver": {
            key: type,
            label: "Skip Over",
            type: "number",
            _value: 0,
            valueTypes: ["scalar","lfo"],
            defaultValue: 0,
            min: 0,
            max: 8,
            step: 1,
            isWholeNumber: true,
            currentValueType,
            inheritsFrom: inheritsFrom || null,
            getValue,
            withNewValue
        }
    });

    const obj = builder[type];

    if (canInherit)
    {
        obj.valueTypes.push("inherit");
    }
    
    obj._value = obj.defaultValue;

    return obj;
}