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
  isNullish,
  KeysOfUnion,
  KeysWithValueType,
  Optional,
} from "../lib/utils";
import useNow from "../Hooks/useNow";
import ModChainInputNode from "./ModChainInputNode";
import { getProperty, setProperty } from "dot-prop";
import usePropRef from "../Hooks/usePropRef";

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
  const onChange = numberInputProps?.onChange;

  const updateRawValue = useCallback(
    (value: number) => {
      setState(
        produce<AppState>((s) => {
          const mod = s.modChains[modChainId].mods[modChainItemId] as T;
          setProperty(mod as Record<string, unknown>, modChainItemProperty as string, value);
        }),
      );

      if (onChange) {
        onChange(value);
      }
    },
    [modChainId, modChainItemId, modChainItemProperty, onChange, setState],
  );

  const connection = useMemo(() => {
    return findModChainConnection(modChain, {
      to: modChainItemId,
      toProperty: modChainItemProperty as string,
      fromOutput: null,
    });
  }, [modChain, modChainItemId, modChainItemProperty]);

  const inputValue = useMemo(() => {
    if (!connection) return undefined;

    return resolveModItem(state, modChainId, connection.from, connection.fromOutput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, inputtableValue, state.modChains, modChain]);

  const coerce = usePropRef((_: number) =>
    numberInputProps?.coerce ? numberInputProps.coerce(_) : _,
  );
  const coerced = useMemo(
    () => (connection && coerce.current ? coerce.current(inputValue!) : undefined),
    [connection, inputValue, coerce],
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
