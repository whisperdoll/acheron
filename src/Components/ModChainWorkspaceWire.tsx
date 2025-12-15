import { useCallback, useContext, useMemo } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import { cx } from "../lib/utils";
import state from "../state/AppState";

type Props =
  | {
      from: string;
      to: { x: number; y: number } | null;
    }
  | {
      from: string;
      toId: string;
      toProperty: string;
    }
  | {
      from: string;
      toOutput: boolean;
    };

export default function ModChainWorkspaceWire(props: Props) {
  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const offset = useMemo(() => {
    const bounds = modChainWorkspaceContext.containerBounds;
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: bounds.left,
      y: bounds.top,
    };
  }, [modChainWorkspaceContext.containerBounds]);
  const currentModChain = state.useState(
    (s) => s.modChains[modChainWorkspaceContext.modChainId]
  );

  const sourcePosition = useMemo(() => {
    const node = currentModChain.mods[props.from];
    const el = document.querySelector(
      `[data-mod-chain-output-node="${props.from}"]`
    );

    if (!el) return;

    const bounds = el.getBoundingClientRect();

    return {
      x:
        bounds.left +
        bounds.width / 2 +
        (modChainWorkspaceContext.containerBounds?.scrollLeft ?? 0),
      y: bounds.top + bounds.height / 2,
    };
  }, [
    props.from,
    currentModChain.mods,
    modChainWorkspaceContext.containerBounds,
  ]);

  const targetPosition = useMemo(() => {
    if ("to" in props) {
      return props.to;
    } else if ("toId" in props) {
      const el = document.querySelector(
        `[data-mod-chain-input-node-id="${props.toId}"][data-mod-chain-input-node-property="${props.toProperty}"]`
      );

      if (!el) return;
      const bounds = el.getBoundingClientRect();
      return {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
    } else {
      const el = document.querySelector(".modChainWorkspaceOutput");
      if (!el) return;
      const bounds = el.getBoundingClientRect();

      return {
        x: bounds.left,
        y: bounds.top + bounds.height / 2,
      };
    }
  }, [
    "to" in props && props.to,
    "toId" in props && props.toId,
    "toProperty" in props && props.toProperty,
    "toOutput" in props && props.toOutput,
    modChainWorkspaceContext.containerBounds,
  ]);

  const qPosition = useMemo(() => {
    if (!sourcePosition || !targetPosition) return;

    return {
      x: (sourcePosition.x + targetPosition.x) / 2,
      y: (sourcePosition.y + targetPosition.y) / 2 + 32,
    };
  }, [sourcePosition, targetPosition]);

  return (
    sourcePosition &&
    targetPosition &&
    qPosition && (
      <path
        d={`
          M ${sourcePosition.x - offset.x},${sourcePosition.y - offset.y}
          Q ${qPosition.x - offset.x},${qPosition.y - offset.y}
          ${targetPosition.x - offset.x},${targetPosition.y - offset.y}
        `}
      />
    )
  );
}
