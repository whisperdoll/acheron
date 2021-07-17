import React, { useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppContext } from '../AppContext';
import { ControlState, ControlValueType, getControlValue, Lfo } from '../Types';
import { capitalize } from '../utils/utils';
import triad0 from "../../assets/triads/0.png";
import triad1 from "../../assets/triads/1.png";
import triad2 from "../../assets/triads/2.png";
import triad3 from "../../assets/triads/3.png";
import triad4 from "../../assets/triads/4.png";
import triad5 from "../../assets/triads/5.png";
import triad6 from "../../assets/triads/6.png";
import direction0 from "../../assets/directions/0.png";
import direction1 from "../../assets/directions/1.png";
import direction2 from "../../assets/directions/2.png";
import direction3 from "../../assets/directions/3.png";
import direction4 from "../../assets/directions/4.png";
import direction5 from "../../assets/directions/5.png";
import { buildLfo } from '../utils/DefaultDefinitions';
import NumberInput from './NumberInput';

interface Props
{
    controlId: string;
    layerIndex: number;
}

export default function(props: Props)
{
    const { state, dispatch } = useContext(AppContext)!;
    const [_, forceUpdate] = useReducer((x) => x + 1, 0);
    const controlState = state.controls[props.controlId];

    if (!controlState)
    {
        throw "bad control id";
    }

    const layerIndex = useMemo(() => {
            let index = state.layers.findIndex(
                l => (
                    l.transpose === props.controlId ||
                    l.tempo === props.controlId ||
                    l.barLength === props.controlId ||
                    l.velocity === props.controlId ||
                    l.emphasis === props.controlId ||
                    l.noteLength === props.controlId ||
                    l.timeToLive === props.controlId ||
                    l.pulseEvery === props.controlId ||
                    l.tokenIds.some(tidArray => tidArray.some(tid => state.tokens[tid].controlIds.includes(props.controlId)))
                )
            );

            if (index === -1)
            {
                index = state.selectedHex.layerIndex;
            }

            return index;
        },
        [ props.controlId, state.selectedHex.layerIndex ]
    );
    // const tempo = layerIndex === -1 ? getControlValue(state, state.controls[state.tempo]) : getControlValue(state, state.controls[state.layers[layerIndex].tempo]);
    // const bpms = 60 / tempo * 1000;
    // const now = Math.floor(Date.now() / bpms) * bpms;

    const controlValueDeps = [ state.controls[props.controlId], Math.floor(state.layers[layerIndex].currentBeat) ];
    const controlValue = useMemo(() => getControlValue(state, props.layerIndex, controlState) ?? 0, controlValueDeps);

    function handleChange(partial: Partial<ControlState>)
    {
        dispatch({ type: "setControl", payload: { id: props.controlId, controlState: {
            ...controlState,
            ...partial
        }}});
    }

    const handleValueChanged = (value: any) =>
    {
        let newValue: any = null;

        switch (controlState.type)
        {
            case "bool":
                newValue = value;
                break;
            case "int":
                newValue = Math.floor(value);
                break;
            case "decimal":
                newValue = value;
                break;
            case "direction":
                newValue = Math.min(Math.max(0, Math.floor(value)), 5);
                break;
            default:
                throw "uh oh...";
        }

        if (newValue === null) throw "uh oh...";
        handleChange({ scalarValue: newValue });
    }

    function handleSelectValueChanged(e: React.ChangeEvent<HTMLSelectElement>)
    {
        handleChange({ scalarValue: e.currentTarget.value });
    }

    function handleDirectionChanged(direction: number)
    {
        handleChange({ scalarValue: direction });
    }

    const handleValueTypeChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    {
        handleChange({ currentValueType: e.currentTarget.value as ControlValueType });
    };

    function handleTriadChanged(triad: number)
    {
        handleChange({ scalarValue: triad });
    }

    let controlPart: JSX.Element;
    if(controlState.currentValueType === "scalar")
    {
        switch (controlState.type)
        {
            case "bool":
                controlPart = <input
                    type="checkbox"
                    onChange={(e) => handleValueChanged(e.currentTarget.checked)}
                    checked={controlValue as boolean ?? false}
                />;
                break;
            case "int":
            case "decimal":
                controlPart = <NumberInput
                    onChange={handleValueChanged}
                    value={controlValue as number ?? 0}
                    max={controlState.max}
                    min={controlState.min}
                    step={controlState.step}
                    roundPlaces={controlState.type === "int" ? 0 : 9}
                />;
                break;
            case "direction":
                controlPart = <div className="directionRow">
                    {[direction0, direction1, direction2, direction3, direction4, direction5].map((direction, i) => (
                        <button
                            key={i}
                            className={controlValue === i ? "selected" : ""}
                            style={{
                                backgroundImage: `url(${direction})`
                            }}
                            onClick={() => handleDirectionChanged(i)}>
                        </button>
                    ))}
                </div>
                break;
            case "select":
                controlPart = (<select
                    onChange={handleSelectValueChanged}
                    value={controlValue as string ?? ""}
                >
                    {controlState.options?.map((option) =>
                    (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>)
                break;
            case "triad":
                controlPart = <div className="triadRow">
                    {[triad0, triad1, triad2, triad3, triad4, triad5, triad6].map((triad, i) => (
                        <button
                            key={i}
                            className={controlValue === i ? "selected" : ""}
                            style={{
                                backgroundImage: `url(${triad})`
                            }}
                            onClick={() => handleTriadChanged(i)}>
                        </button>
                    ))}
                </div>
        }
    }
    else // LFO
    {
        switch (controlState.type)
        {
            case "bool":
            case "decimal":
            case "int":
            default:
                controlPart = <div>{controlValue}</div>;
                break;
            case "select":
                controlPart = <div>{controlState.options!.find(({ value }) => value === controlValue)!.label}</div>
                break;
            case "direction":
                controlPart = <div className="directionRow disabled">
                    {[direction0, direction1, direction2, direction3, direction4, direction5].map((direction, i) => (
                        <button
                            key={i}
                            className={controlValue === i ? "selected noclicky" : "noclicky"}
                            style={{
                                backgroundImage: `url(${direction})`
                            }}
                        >
                        </button>
                    ))}
                </div>
                break;
            case "triad":
                controlPart = <div className="triadRow disabled">
                    {[triad0, triad1, triad2, triad3, triad4, triad5, triad6].map((triad, i) => (
                        <button
                            key={i}
                            className={controlValue === i ? "selected noclicky" : "noclicky"}
                            style={{
                                backgroundImage: `url(${triad})`
                            }}
                        >
                        </button>
                    ))}
                </div>
                break;
        }
    }

    return (
        <div className="control">
            <div className="labelRow">
                <div className="label">{controlState.label}</div>
                <select
                    value={controlState.currentValueType}
                    onChange={handleValueTypeChanged}
                    className="valueType"
                >
                    <option value="scalar">Scalar</option>
                    {(controlState.inherit && <option value="inherit">Inherit</option>)}
                    <option value="lfo">LFO</option>
                </select>
            </div>
            <div className="controlRow">
                {controlPart}
            </div>
            {controlState.currentValueType === "lfo" && (
                <button
                    className="editLfo"
                    onClick={() => dispatch({ type: "editLfo", payload: { controlId: props.controlId }})}
                >✎ Edit LFO</button>
            )}
        </div>
    );
};