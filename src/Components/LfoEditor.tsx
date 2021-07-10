import React, { useContext } from 'react'
import { AppContext } from '../AppContext';
import { Lfo, LfoType, LfoTypes } from '../Types';
import { capitalize } from '../utils/utils';
import NumberInput from './NumberInput';

export default function LfoEditor()
{
    const { state, dispatch } = useContext(AppContext)!;

    const modifyingControl = state.controls[state.editingLfo!.controlId];
    const modifyingLfo = modifyingControl.lfo;

    function modifyLfo(partial: Partial<Lfo>)
    {
        const lfo: Lfo = {
            ...modifyingLfo,
            ...partial
        };

        dispatch({ type: "setLfo", payload: { ...state.editingLfo!, lfo } });
    }

    const coerce = modifyingControl.type === "decimal" ? ((v: number) => v) : Math.floor;

    return (
        <div className="lfoEditor-backdrop">
            <div className="lfoEditor-content">
                <h1>{modifyingControl.label} LFO</h1>
                <div className="row">
                    <span>LFO Type:</span>
                    <select
                        onChange={e => modifyLfo({ type: e.currentTarget.value as LfoType })}
                        value={modifyingLfo.type}
                    >
                        {LfoTypes.map(lfoType => (
                            <option
                                key={lfoType}
                                value={lfoType}
                            >
                                {capitalize(lfoType)}
                            </option>
                        ))}
                    </select>
                </div>
                {modifyingLfo.type !== "sequence" && (<>
                    <div className="row">
                        <span>Min Value:</span>
                        <NumberInput
                            min={modifyingControl.min}
                            max={Math.min(modifyingControl.max, modifyingLfo.max)}
                            value={modifyingLfo.min}
                            coerce={coerce}
                            onChange={value => modifyLfo({ min: value })}
                        />
                    </div>
                    <div className="row">
                        <span>Max Value:</span>
                        <NumberInput
                            min={Math.max(modifyingControl.min, modifyingLfo.min)}
                            max={modifyingControl.max}
                            value={modifyingLfo.max}
                            coerce={coerce}
                            onChange={value => modifyLfo({ max: value })}
                        />
                    </div>
                </>)}
                {modifyingLfo.type !== "square" && (
                    <div className="row">
                        <span>Period (seconds):</span>
                        <NumberInput
                            value={modifyingLfo.period}
                            min={0.1}
                            onChange={newValue => modifyLfo({ period: Math.max(newValue) })}
                            step={0.1}
                        />
                    </div>
                )}
                {modifyingLfo.type === "square" && (<>
                    <div className="row">
                        <span>Low Period (seconds):</span>
                        <NumberInput
                            value={modifyingLfo.lowPeriod}
                            min={0.1}
                            onChange={newValue => modifyLfo({ lowPeriod: Math.max(newValue) })}
                            step={0.1}
                        />
                    </div>
                    <div className="row">
                        <span>High Period (seconds):</span>
                        <NumberInput
                            value={modifyingLfo.hiPeriod}
                            min={0.1}
                            onChange={newValue => modifyLfo({ hiPeriod: Math.max(newValue) })}
                            step={0.1}
                        />
                    </div>
                </>)}
                {modifyingLfo.type === "sequence" && (
                    <div className="sequence">
                        <div>Sequence:</div>
                        {modifyingLfo.sequence.map((value, i) => (
                            <div className="row">
                                <NumberInput
                                    min={modifyingControl.min}
                                    max={modifyingControl.max}
                                    value={value}
                                    onChange={newValue => modifyLfo({ sequence: modifyingLfo.sequence.map((v, vi) => vi === i ? coerce(newValue) : v) })}
                                />
                                <button
                                    onClick={() => modifyLfo({ sequence: modifyingLfo.sequence.filter((_, vi) => vi !== i) })}
                                >
                                    ✖ Remove
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => modifyLfo({ sequence: modifyingLfo.sequence.concat([ 0 ]) })}
                        >
                            + Add Value
                        </button>
                    </div>
                )}
                <div className="bottomButtons">
                    <button
                        onClick={() => dispatch({ type: "stopEditingLfo" })}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
