import React, { useContext, useMemo } from "react";
import { ControlState, Lfo, LfoConnectableProperty, LfoType, LfoTypes } from "../Types";
import { capitalize } from "../utils/utils";
import NumberInput from "./NumberInput";
import ModChainInputNode from "./ModChainInputNode";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { isNil } from "../lib/utils";
import { AppContext, resolveModItem } from "../state/AppState";

interface Props {
  control?: ControlState;
  lfo: Lfo;
  onUpdate: (newLfo: Lfo) => unknown;
  modItemId?: string;
}

const emptyArray: {
  from: string;
  to: string;
  property: string;
}[] = [];

export default React.memo(function LfoControls({ control, lfo, onUpdate, modItemId }: Props) {
  const { state, setState } = useContext(AppContext)!;

  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const modChain = state.modChainControl ? state.modChains[state.modChainControl] : null;
  const now = Math.round(state.layers[0].currentTimeMs / 60);

  const inputValues = useMemo(() => {
    const ret: Partial<Record<LfoConnectableProperty, number>> = {};

    if (!modItemId || !modChain) return ret;

    modChain.connections.forEach((connection) => {
      if (connection.to === modItemId) {
        ret[connection.toProperty as LfoConnectableProperty] = resolveModItem(
          state,
          state.modChainControl!,
          connection.from,
          connection.fromOutput,
        );
      }
    });

    return ret;
  }, [lfo, modItemId, modChain, now]);

  function modifyLfo(partial: Partial<Lfo>) {
    onUpdate({ ...lfo, ...partial });
  }

  const coerce =
    !control || control.definition.type === "decimal" ? (v: number) => v : Math.floor;

  return (
    <>
      <div className="lfoControls">
        <div className="typePart">
          <span className="label">Type:</span>
          <select
            onChange={(e) => modifyLfo({ type: e.currentTarget.value as LfoType })}
            value={lfo.type}
          >
            {LfoTypes.map((lfoType) => (
              <option key={lfoType} value={lfoType}>
                {capitalize(lfoType)}
              </option>
            ))}
          </select>
        </div>
        <>
          <div className="minPart">
            {modItemId && <ModChainInputNode modItemId={modItemId} property="min" />}
            <span className="label">Min:</span>
            {!isNil(inputValues.min) ? (
              <div className="inputValue">{inputValues.min}</div>
            ) : (
              <NumberInput
                value={lfo.min}
                coerce={coerce}
                onChange={(value) => modifyLfo({ min: value })}
                min={-9999}
                max={9999}
              />
            )}
          </div>

          <div className="maxPart">
            {modItemId && <ModChainInputNode modItemId={modItemId} property="max" />}
            <span className="label">Max:</span>
            {!isNil(inputValues.max) ? (
              <div className="inputValue">{inputValues.max}</div>
            ) : (
              <NumberInput
                min={-9999}
                max={9999}
                value={lfo.max}
                coerce={coerce}
                onChange={(value) => modifyLfo({ max: value })}
              />
            )}
          </div>
        </>
        {lfo.type !== "square" && lfo.type !== "random" && (
          <div className="periodPart">
            {modItemId && <ModChainInputNode modItemId={modItemId} property="period" />}
            <span className="label">Period:</span>
            {!isNil(inputValues.period) ? (
              <div className="inputValue">{inputValues.period}</div>
            ) : (
              <NumberInput
                value={lfo.period}
                max={9999}
                min={0.1}
                onChange={(newValue) => modifyLfo({ period: Math.max(newValue) })}
                step={0.1}
              />
            )}
          </div>
        )}
        {lfo.type === "square" && (
          <>
            <div className="loPeriodPart">
              {modItemId && <ModChainInputNode modItemId={modItemId} property="lowPeriod" />}
              <span className="label">Lo Period:</span>
              {!isNil(inputValues.lowPeriod) ? (
                <div className="inputValue">{inputValues.lowPeriod}</div>
              ) : (
                <NumberInput
                  value={lfo.lowPeriod}
                  min={0.1}
                  max={9999}
                  onChange={(newValue) => modifyLfo({ lowPeriod: Math.max(newValue) })}
                  step={0.1}
                />
              )}
            </div>
            <div className="hiPeriodPart">
              {modItemId && <ModChainInputNode modItemId={modItemId} property="hiPeriod" />}
              <span className="label">Hi Period:</span>
              {!isNil(inputValues.hiPeriod) ? (
                <div className="inputValue">{inputValues.hiPeriod}</div>
              ) : (
                <NumberInput
                  value={lfo.hiPeriod}
                  min={0.1}
                  max={9999}
                  onChange={(newValue) => modifyLfo({ hiPeriod: Math.max(newValue) })}
                  step={0.1}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
});
