import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ModChainWorkspaceContext } from "../state/ModChainWorkspaceContext";
import ModChainWorkspaceWire from "./ModChainWorkspaceWire";
import { sliceObject } from "../utils/utils";
import { AppContext } from "../state/AppState";

interface Props {}

export default function ModChainWorkspaceWires(props: Props) {
  const { state, setState } = useContext(AppContext)!;

  const modChainWorkspaceContext = useContext(ModChainWorkspaceContext);
  const modChain = state.modChains[state.modChainControl!];
  const [mousePosition, setMousePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const documentBounds = modChainWorkspaceContext.containerBounds;

  useEffect(() => {
    const onMouseMove = (e: PointerEvent) => {
      if (documentBounds) {
        setMousePosition({
          x: e.clientX,
          y: e.clientY,
        });
      }
    };

    document.body.addEventListener("pointermove", onMouseMove);

    setMousePosition(null);

    return () => {
      document.body.removeEventListener("pointermove", onMouseMove);
    };
  }, [modChainWorkspaceContext.connectingOutput]);

  return (
    <div className="modChainWorkspaceWires">
      <svg
        viewBox={`0 0 ${documentBounds?.width ?? 0} ${documentBounds?.height ?? 0}`}
        stroke="rgba(255, 0, 0, 0.5)"
        strokeWidth={2}
        fill="transparent"
      >
        {modChainWorkspaceContext.connectingOutput && (
          <ModChainWorkspaceWire
            from={modChainWorkspaceContext.connectingOutput.modItemId}
            fromOutput={modChainWorkspaceContext.connectingOutput.outputKey}
            to={mousePosition}
          />
        )}
        {modChain.output && (
          <ModChainWorkspaceWire
            from={modChain.output.from}
            fromOutput={modChain.output.fromOutput}
            toOutput
          />
        )}
        {modChain.connections.map((connection) => {
          return (
            <ModChainWorkspaceWire
              key={`${connection.from}__${connection.to}__${connection.toProperty}__${connection.fromOutput}`}
              from={connection.from}
              fromOutput={connection.fromOutput}
              toId={connection.to}
              toProperty={connection.toProperty}
            />
          );
        })}
      </svg>
    </div>
  );
}
