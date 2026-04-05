import React, { useContext, useEffect, useRef } from "react";
import { AppContext, LayerState } from "../state/AppState";
import GoogleIconButton from "./GoogleIconButton";
import List from "../lib/list";

export default function GridModeMenu() {
  const { state, setState } = useContext(AppContext)!;

  const ref = useRef<HTMLDivElement>(null);

  function addRow() {
    const newLayers: LayerState[] = [];

    state.layers.forEach((layer, i) => {
      const newLayer: typeof layer = {
        ...layer,
        tokenIds: List.copy(layer.tokenIds),
        playheads: List.copy(layer.playheads),
      };
      // 7,
      // 14,
      // 21...
      List.reversed(
        List.range({
          from: state.gridRows,
          length: state.gridCols,
          stride: state.gridRows,
        }),
      ).forEach((indexToInsertInto) => {
        newLayer.tokenIds.splice(indexToInsertInto, 0, []);
        newLayer.playheads.splice(indexToInsertInto, 0, []);
      });

      newLayers.push(newLayer);
    });

    setState((s) => ({
      ...s,
      layers: newLayers,
      gridRows: state.gridRows + 1,
      selectedHex: {
        hexIndex: -1,
        layerIndex: state.selectedHex.layerIndex,
      },
    }));
  }

  function removeRow() {
    if (state.gridRows === 1) return;

    const newLayers: LayerState[] = [];

    state.layers.forEach((layer, i) => {
      const newLayer: typeof layer = {
        ...layer,
        tokenIds: List.copy(layer.tokenIds),
        playheads: List.copy(layer.playheads),
      };
      // 7,
      // 14,
      // 21...
      List.reversed(
        List.range({
          from: state.gridRows - 1,
          length: state.gridCols,
          stride: state.gridRows,
        }),
      ).forEach((indexToInsertInto) => {
        newLayer.tokenIds.splice(indexToInsertInto, 1);
        newLayer.playheads.splice(indexToInsertInto, 1);
      });

      newLayers.push(newLayer);
    });

    setState((s) => ({
      ...s,
      layers: newLayers,
      gridRows: state.gridRows - 1,
      selectedHex: {
        hexIndex: -1,
        layerIndex: state.selectedHex.layerIndex,
      },
    }));
  }

  function addColumn() {
    const newLayers: LayerState[] = [];

    state.layers.forEach((layer, i) => {
      const newLayer: typeof layer = {
        ...layer,
        tokenIds: List.copy(layer.tokenIds),
        playheads: List.copy(layer.playheads),
      };

      List.range(state.gridRows).forEach(() => {
        newLayer.tokenIds.push([]);
        newLayer.playheads.push([]);
      });

      newLayers.push(newLayer);
    });

    setState((s) => ({
      ...s,
      layers: newLayers,
      gridCols: state.gridCols + 1,
      selectedHex: {
        hexIndex: -1,
        layerIndex: state.selectedHex.layerIndex,
      },
    }));
  }

  function removeColumn() {
    const newLayers: LayerState[] = [];

    state.layers.forEach((layer, i) => {
      const newLayer: typeof layer = {
        ...layer,
        tokenIds: List.copy(layer.tokenIds),
        playheads: List.copy(layer.playheads),
      };

      newLayer.tokenIds.splice(
        state.gridCols * state.gridRows - state.gridRows,
        state.gridRows,
      );
      newLayer.playheads.splice(
        state.gridCols * state.gridRows - state.gridRows,
        state.gridRows,
      );

      newLayers.push(newLayer);
    });

    setState((s) => ({
      ...s,
      layers: newLayers,
      gridCols: state.gridCols - 1,
      selectedHex: {
        hexIndex: -1,
        layerIndex: state.selectedHex.layerIndex,
      },
    }));
  }

  useEffect(() => {
    function pointerDown(e: PointerEvent) {
      if (!(e.target instanceof HTMLElement)) return;
      if (!ref.current) return;

      const tree: HTMLElement[] = [e.target];

      while (tree.at(-1)!.parentElement) {
        tree.push(tree.at(-1)!.parentElement!);
      }

      if (
        e.target instanceof HTMLElement &&
        (ref.current.contains(e.target) ||
          tree.some((el) => el.dataset.gridSizeMenu))
      ) {
        e.stopPropagation();
        return;
      }

      setState((s) => ({
        ...s,
        isShowingGridSizeMenu: false,
      }));
    }

    document.addEventListener("pointerdown", pointerDown);

    return () => document.removeEventListener("pointerdown", pointerDown);
  }, []);

  return (
    <div className="gridSizeMenu" ref={ref}>
      <div className="gridSizeMenuRow">
        <GoogleIconButton
          icon="remove"
          buttonStyle="rounded"
          fill
          naked
          size={1.5}
          onClick={() => removeRow()}
        />
        Rows: {state.gridRows}
        <GoogleIconButton
          icon="add"
          buttonStyle="rounded"
          fill
          naked
          size={1.5}
          onClick={() => addRow()}
        />
      </div>
      <div className="gridSizeMenuRow">
        <GoogleIconButton
          icon="remove"
          buttonStyle="rounded"
          fill
          naked
          size={1.5}
          onClick={() => removeColumn()}
        />
        Columns: {state.gridCols}
        <GoogleIconButton
          icon="add"
          buttonStyle="rounded"
          fill
          naked
          size={1.5}
          onClick={() => addColumn()}
        />
      </div>
    </div>
  );
}
