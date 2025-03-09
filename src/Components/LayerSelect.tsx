import React from "react";
import state from "../state/AppState";
import settings from "../state/AppSettings";
import IconButton from "./IconButton";
import {
  faCheck,
  faEdit,
  faMinus,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { confirmPrompt } from "../utils/utils";

interface Props {}

const LayerSelect: React.FC<Props> = React.memo(() => {
  const reactiveState = state.useState((s) => ({
    isEditingLayerName: s.isEditingLayerName,
    currentLayerName: s.layers[s.selectedHex.layerIndex].name,
    currentLayerIndex: s.selectedHex.layerIndex,
    layerNames: s.layers.map((l) => l.name),
  }));

  async function confirmRemoveLayer(layerIndex?: number) {
    if (layerIndex === undefined) {
      layerIndex = state.values.selectedHex.layerIndex;
    }

    if (state.values.layers.length === 1) {
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
        `Are you sure you want to delete the layer '${state.values.layers[layerIndex].name}'?`,
        "Confirm delete"
      ))
    ) {
      state.removeLayer(layerIndex, "removing layer");
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
              state.setLayer(
                "current",
                (layer) => ({
                  ...layer,
                  name: e.currentTarget.value,
                }),
                "change layer name"
              )
            }
          />
        ) : (
          <select
            className="layerSelect"
            onChange={(e) =>
              state.set(
                (state) => ({
                  selectedHex: {
                    ...state.selectedHex,
                    layerIndex: parseInt(e.currentTarget.value),
                  },
                }),
                "change layer from select"
              )
            }
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
        <IconButton
          onClick={(e) =>
            state.set({ isEditingLayerName: false }, "stop edit layer name")
          }
          icon={faCheck}
        >
          Save Name
        </IconButton>
      ) : (
        <IconButton
          onClick={(e) =>
            state.set({ isEditingLayerName: true }, "edit layer name")
          }
          icon={faEdit}
        >
          Edit Name
        </IconButton>
      )}
      <IconButton
        onClick={() => confirmRemoveLayer()}
        className="delete"
        icon={faMinus}
      >
        Delete Layer
      </IconButton>
      <IconButton
        onClick={(e) => state.addLayer(true, "add layer button")}
        icon={faPlus}
      >
        Add New Layer
      </IconButton>
    </div>
  );
});

export default LayerSelect;
