import React, { useContext } from "react";
import settings from "../state/AppSettings";
import GoogleIconButton from "./GoogleIconButton";
import { confirmPrompt } from "../utils/desktop";
import useKeyboardShortcutStrings from "../Hooks/useKeyboardShortcutStrings";
import { addLayer, AppContext, removeLayer, setLayer } from "../state/AppState";

interface Props {}

const LayerSelect: React.FC<Props> = React.memo(() => {
  const { state, setState } = useContext(AppContext)!;
  const reactiveState = {
    isEditingLayerName: state.isEditingLayerName,
    currentLayerName: state.layers[state.selectedHex.layerIndex].name,
    currentLayerIndex: state.selectedHex.layerIndex,
    layerNames: state.layers.map((l) => l.name),
  };
  const keyboardShortcutStrings = useKeyboardShortcutStrings();

  async function confirmRemoveLayer(layerIndex?: number) {
    if (layerIndex === undefined) {
      layerIndex = state.selectedHex.layerIndex;
    }

    if (state.layers.length === 1) {
      // TODO
      // remote.dialog.showMessageBox(remote.getCurrentWindow(), {
      //   message: "You must have at least one layer.",
      //   buttons: ["Fine"],
      //   noLink: true,
      //   type: "info",
      //   title: "Cannot delete only layer",
      // });
    } else if (
      !settings.values.confirmDelete ||
      (await confirmPrompt(
        `Are you sure you want to delete the layer '${state.layers[layerIndex].name}'?`,
        "Confirm delete",
      ))
    ) {
      removeLayer(setState, layerIndex, "removing layer");
    }
  }

  return (
    <div className="layerSelectRow">
      <label>
        <span className="layerLabel">Layer: </span>
        {reactiveState.isEditingLayerName ? (
          <input
            value={reactiveState.currentLayerName}
            onChange={(e) =>
              setLayer(setState, "current", (layer) => ({
                ...layer,
                name: e.currentTarget.value,
              }))
            }
          />
        ) : (
          <select
            className="layerSelect"
            onChange={(e) => {
              const layerIndex = parseInt(e.currentTarget.value);
              setState((state) => ({
                ...state,
                selectedHex: {
                  ...state.selectedHex,
                  layerIndex,
                },
              }));
            }}
            value={reactiveState.currentLayerIndex}
          >
            {reactiveState.layerNames.map((name, i) => (
              <option key={i} value={i}>
                {name}
                {i === reactiveState.currentLayerIndex || i > 9
                  ? ""
                  : ` (Ctrl+${(i + 1) % 10})`}
              </option>
            ))}
          </select>
        )}
      </label>
      {reactiveState.isEditingLayerName ? (
        <GoogleIconButton
          onClick={(e) =>
            setState((s) => ({ ...s, isEditingLayerName: false }))
          }
          icon="check"
          buttonStyle="rounded"
          fill
        >
          Save Name
        </GoogleIconButton>
      ) : (
        <GoogleIconButton
          onClick={(e) => setState((s) => ({ ...s, isEditingLayerName: true }))}
          icon="edit"
          buttonStyle="rounded"
          fill
        >
          Edit Name
        </GoogleIconButton>
      )}
      <GoogleIconButton
        onClick={() => confirmRemoveLayer()}
        className="delete"
        icon="remove"
        buttonStyle="rounded"
        fill
      >
        Delete Layer
      </GoogleIconButton>
      <GoogleIconButton
        onClick={(e) => addLayer(setState, true, "add layer button")}
        icon="add"
        buttonStyle="rounded"
        fill
      >
        Add Layer ({keyboardShortcutStrings.addNewLayer})
      </GoogleIconButton>
    </div>
  );
});

export default LayerSelect;
