import { TokenDefinition } from "../Types";
import AppState from "../state/AppState";

interface Store {
  gateCounter: number;
}

const ShiftToken: TokenDefinition<Store> = {
  label: "Shift",
  symbol: "<",
  uid: "hvst.shift",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
    },
	shift: {
      label: "Shift",
      type: "int",
      min: -8,
      max: 8,
      defaultValue: 1,
    },
    gateOffset: {
      label: "Gate Offset",
      type: "int",
      min: 0,
      max: 128,
      defaultValue: 0,
    },
    gateOff: {
      label: "Gate-Off",
      type: "int",
      min: 0,
      max: 128,
      defaultValue: 0,
    },
    gateOn: {
      label: "Gate-On",
      type: "int",
      min: 0,
      max: 128,
      defaultValue: 0,
    },
  },
  callbacks: {
    onStart(store, helpers) {
      if (store.gateCounter == undefined) {
        store.gateCounter = 0;
      }
    },
    onTick(store, helpers, playheads) {
      const {
        probability,
        shift,
        gateOffset,
        gateOn,
        gateOff,
      } = helpers.getControlValues();

      function tryPerformShift(playheadIndex: number) {
        if (probability / 100 > Math.random()) {
            const newLocation = Math.max(Math.min(helpers.getHexIndex() + (shift * 24), 203), 0);
            helpers.warpPlayhead(playheadIndex, newLocation, helpers.getLayer());
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0) return;

        if (gateOn + gateOff === 0) {
          tryPerformShift(playheadIndex);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformShift(playheadIndex);
          }
          store.gateCounter++;
          if (store.gateCounter >= gateOffset + gateOff + gateOn) {
            store.gateCounter = 0;
          }
        }
      });
    },
  },
};

export default ShiftToken;
