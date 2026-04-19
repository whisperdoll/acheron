import React, { ReactElement, useCallback, useContext, useMemo } from "react";
import { ModChain, ModChainItem } from "../Types";
import NumberInput, { NumberInputProps } from "./NumberInput";
import { AppContext, AppState, resolveModItem } from "../state/AppState";
import { produce } from "immer";
import { KeysOfUnion, KeysWithValueType, Optional } from "../lib/utils";
import useNow from "../Hooks/useNow";
import ModChainInputNode from "./ModChainInputNode";

interface Props<T extends ModChainItem> {
  modChainId: string;
  modChainItemId: string;
  modChainItemProperty: KeysOfUnion<T>;
  numberInputProps?: Optional<Omit<NumberInputProps, "value">, "onChange">;
}

function InputtableValue<T extends ModChainItem>({
  modChainId,
  modChainItemId,
  modChainItemProperty,
  numberInputProps,
}: Props<T>) {
  const { state, setState } = useContext(AppContext)!;
  const now = useNow();

  const modChain = state.modChains[modChainId];
  const modChainItem = modChain.mods[modChainItemId] as T;
  const inputtableValue = modChainItem[modChainItemProperty] as number;

  const updateRawValue = useCallback(
    (value: number) => {
      setState(
        produce<AppState>((s) => {
          const mod = s.modChains[modChainId].mods[modChainItemId] as T;
          (mod[modChainItemProperty] as number) = value;
        }),
      );

      if (numberInputProps?.onChange) {
        numberInputProps.onChange(value);
      }
    },
    [modChainId, modChainItemId, modChainItemProperty],
  );

  const connection = useMemo(() => {
    return modChain.connections.find(
      (c) => c.to === modChainItemId && c.property === modChainItemProperty,
    );
  }, [modChain.connections]);

  const inputValue = useMemo(() => {
    if (!connection) return undefined;

    return resolveModItem(state, modChain, connection.from);
  }, [now, inputtableValue, state.modChains, modChain]);

  return (
    <div className="inputtableValue row">
      <ModChainInputNode
        modItemId={modChainItemId}
        property={modChainItemProperty as string}
      />
      {!connection ? (
        <NumberInput {...numberInputProps} onChange={updateRawValue} value={inputtableValue} />
      ) : (
        <div className="inputValue">{inputValue}</div>
      )}
    </div>
  );
}

export default React.memo(InputtableValue) as <T extends ModChainItem>(
  props: Props<T>,
) => ReactElement | null;
