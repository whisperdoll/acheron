import React from "react";
import { ControlState, Lfo, LfoType, LfoTypes } from "../Types";
import state from "../state/AppState";
import { capitalize } from "../utils/utils";
import NumberInput from "./NumberInput";

interface Props {
  control: ControlState;
}

export default React.memo(function LfoControls({ control }: Props) {
  const modifyingLfo = control.lfo;

  function modifyLfo(partial: Partial<Lfo>) {
    state.set(
      (prev) => ({
        controls: {
          ...prev.controls,
          [control.id]: {
            ...prev.controls[control.id],
            lfo: {
              ...prev.controls[control.id].lfo,
              ...partial,
            },
          },
        },
      }),
      "modify lfo"
    );
  }

  const coerce = control.type === "decimal" ? (v: number) => v : Math.floor;

  return (
    <>
      <div className="controlRow">
        <span className="label">Type:</span>
        <select onChange={(e) => modifyLfo({ type: e.currentTarget.value as LfoType })} value={modifyingLfo.type}>
          {LfoTypes.map((lfoType) => (
            <option key={lfoType} value={lfoType}>
              {capitalize(lfoType)}
            </option>
          ))}
        </select>
      </div>
      {modifyingLfo.type !== "sequence" && (
        <>
          <div className="controlRow">
            <span className="label">Min:</span>
            <NumberInput
              min={-99999}
              max={99999}
              value={modifyingLfo.min}
              coerce={coerce}
              onChange={(value) => modifyLfo({ min: value })}
            />
          </div>
          <div className="controlRow">
            <span className="label">Max:</span>
            <NumberInput
              min={-99999}
              max={99999}
              value={modifyingLfo.max}
              coerce={coerce}
              onChange={(value) => modifyLfo({ max: value })}
            />
          </div>
        </>
      )}
      {modifyingLfo.type !== "square" && modifyingLfo.type !== "midi Control" && modifyingLfo.type !== "random" && (
        <div className="controlRow">
          <span className="label">Period:</span>
          <NumberInput
            value={modifyingLfo.period}
            max={10000}
            min={0.1}
            onChange={(newValue) => modifyLfo({ period: Math.max(newValue) })}
            step={0.1}
          />
        </div>
      )}
      {modifyingLfo.type === "square" && (
        <>
          <div className="controlRow">
            <span className="label">Lo Period:</span>
            <NumberInput
              value={modifyingLfo.lowPeriod}
              min={0.1}
              max={10000}
              onChange={(newValue) => modifyLfo({ lowPeriod: Math.max(newValue) })}
              step={0.1}
            />
          </div>
          <div className="controlRow">
            <span className="label">Hi Period:</span>
            <NumberInput
              value={modifyingLfo.hiPeriod}
              min={0.1}
              max={10000}
              onChange={(newValue) => modifyLfo({ hiPeriod: Math.max(newValue) })}
              step={0.1}
            />
          </div>
        </>
      )}
      {modifyingLfo.type === "sequence" && (
        <div className="sequence">
          <div>Sequence:</div>
          {modifyingLfo.sequence.map((value, i) => (
            <div className="row">
              <NumberInput
                min={control.min}
                max={control.max}
                value={value}
                onChange={(newValue) =>
                  modifyLfo({
                    sequence: modifyingLfo.sequence.map((v, vi) => (vi === i ? coerce(newValue) : v)),
                  })
                }
              />
              <button
                onClick={() =>
                  modifyLfo({
                    sequence: modifyingLfo.sequence.filter((_, vi) => vi !== i),
                  })
                }
              >
                ✖ Remove
              </button>
            </div>
          ))}
          <button onClick={() => modifyLfo({ sequence: modifyingLfo.sequence.concat([0]) })}>+ Add Value</button>
        </div>
      )}
    </>
  );
});
