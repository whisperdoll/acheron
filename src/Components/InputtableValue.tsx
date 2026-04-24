import React, { ReactElement, useCallback, useContext, useMemo } from "react";
import { ModChain, ModChainItem } from "../Types";
import NumberInput, { NumberInputProps } from "./NumberInput";
import {
  AppContext,
  AppState,
  findModChainConnection,
  resolveModItem,
} from "../state/AppState";
import { produce } from "immer";
import {
  formatNumberSmall,
  isNil,
  KeysOfUnion,
  KeysWithValueType,
  Optional,
} from "../lib/utils";
import useNow from "../Hooks/useNow";
import ModChainInputNode from "./ModChainInputNode";
import { getProperty, setProperty } from "dot-prop";

interface Props<T> {
  modChainId: string;
  modChainItemId: string;
  modChainItemProperty: KeysOfUnion<T>;
  numberInputProps?: Optional<Omit<NumberInputProps, "value">, "onChange">;
  label?: string;
}

function InputtableValue<T>({
  modChainId,
  modChainItemId,
  modChainItemProperty,
  label,
  numberInputProps,
}: Props<T>) {
  const { state, setState } = useContext(AppContext)!;
  const now = useNow();

  const modChain = state.modChains[modChainId];
  const modChainItem = modChain.mods[modChainItemId] as T;
  const inputtableValue = getProperty(modChainItem, modChainItemProperty as string) as number;

  const updateRawValue = useCallback(
    (value: number) => {
      setState(
        produce<AppState>((s) => {
          const mod = s.modChains[modChainId].mods[modChainItemId] as T;
          setProperty(mod as Record<string, any>, modChainItemProperty as string, value);
        }),
      );

      if (numberInputProps?.onChange) {
        numberInputProps.onChange(value);
      }
    },
    [modChainId, modChainItemId, modChainItemProperty],
  );

  const connection = useMemo(() => {
    return findModChainConnection(modChain, {
      to: modChainItemId,
      toProperty: modChainItemProperty as string,
      fromOutput: null,
    });
  }, [modChain.connections]);

  const inputValue = useMemo(() => {
    if (!connection) return undefined;

    return resolveModItem(state, modChain, connection.from, connection.fromOutput);
  }, [now, inputtableValue, state.modChains, modChain]);

  const coerce = numberInputProps?.coerce || ((_: number) => _);
  const coerced = useMemo(
    () => (connection ? coerce(inputValue!) : undefined),
    [connection, inputValue],
  );

  return (
    <div className="inputtableValue row">
      <ModChainInputNode
        modItemId={modChainItemId}
        property={modChainItemProperty as string}
      />
      {label && <span className="label">{label}</span>}
      {!connection ? (
        <NumberInput {...numberInputProps} onChange={updateRawValue} value={inputtableValue} />
      ) : (
        <div className="inputValue" title={coerced!.toString()}>
          {formatNumberSmall(coerced!)}
        </div>
      )}
    </div>
  );
}

export default React.memo(InputtableValue) as <T>(props: Props<T>) => ReactElement | null;
