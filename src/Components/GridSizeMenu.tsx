import React, { useEffect, useRef } from "react";
import state, { LayerState } from "../state/AppState";
import GoogleIconButton from "./GoogleIconButton";
import List from "../lib/list";

export default function GridModeMenu() {
  const ref = useRef<HTMLDivElement>(null);
  const reactiveState = state.useState();

  function addRow() {
    const newLayers: LayerState[] = [];

    state.values.layers.forEach((layer, i) => {
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
          from: state.values.gridRows,
          length: state.values.gridCols,
          stride: state.values.gridRows,
        })
      ).forEach((indexToInsertInto) => {
        newLayer.tokenIds.splice(indexToInsertInto, 0, []);
        newLayer.playheads.splice(indexToInsertInto, 0, []);
      });

      newLayers.push(newLayer);
    });

    state.set(
      {
        layers: newLayers,
        gridRows: state.values.gridRows + 1,
        selectedHex: {
          hexIndex: -1,
          layerIndex: state.values.selectedHex.layerIndex,
        },
      },
      "add row"
    );
  }

  function removeRow() {
    if (state.values.gridRows === 1) return;

    const newLayers: LayerState[] = [];

    state.values.layers.forEach((layer, i) => {
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
          from: state.values.gridRows - 1,
          length: state.values.gridCols,
          stride: state.values.gridRows,
        })
      ).forEach((indexToInsertInto) => {
        newLayer.tokenIds.splice(indexToInsertInto, 1);
        newLayer.playheads.splice(indexToInsertInto, 1);
      });

      newLayers.push(newLayer);
    });

    state.set(
      {
        layers: newLayers,
        gridRows: state.values.gridRows - 1,
        selectedHex: {
          hexIndex: -1,
          layerIndex: state.values.selectedHex.layerIndex,
        },
      },
      "remove row"
    );
  }

  function addColumn() {
    const newLayers: LayerState[] = [];

    state.values.layers.forEach((layer, i) => {
      const newLayer: typeof layer = {
        ...layer,
        tokenIds: List.copy(layer.tokenIds),
        playheads: List.copy(layer.playheads),
      };

      List.range(state.values.gridRows).forEach(() => {
        newLayer.tokenIds.push([]);
        newLayer.playheads.push([]);
      });

      newLayers.push(newLayer);
    });

    state.set(
      {
        layers: newLayers,
        gridCols: state.values.gridCols + 1,
        selectedHex: {
          hexIndex: -1,
          layerIndex: state.values.selectedHex.layerIndex,
        },
      },
      "add col"
    );
  }

  function removeColumn() {
    const newLayers: LayerState[] = [];

    state.values.layers.forEach((layer, i) => {
      const newLayer: typeof layer = {
        ...layer,
        tokenIds: List.copy(layer.tokenIds),
        playheads: List.copy(layer.playheads),
      };

      newLayer.tokenIds.splice(
        state.values.gridCols * state.values.gridRows - state.values.gridRows,
        state.values.gridRows
      );
      newLayer.playheads.splice(
        state.values.gridCols * state.values.gridRows - state.values.gridRows,
        state.values.gridRows
      );

      newLayers.push(newLayer);
    });

    state.set(
      {
        layers: newLayers,
        gridCols: state.values.gridCols - 1,
        selectedHex: {
          hexIndex: -1,
          layerIndex: state.values.selectedHex.layerIndex,
        },
      },
      "remove col"
    );
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

      state.set(
        (s) => ({
          ...s,
          isShowingGridSizeMenu: false,
        }),
        "toggle showing grid size menu"
      );
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
        Rows: {reactiveState.gridRows}
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
        Columns: {reactiveState.gridCols}
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
