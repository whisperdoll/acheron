import { TokenDefinition } from "../Types";

interface Store {
  gateCounter: number;
}

const RandomizeToken: TokenDefinition<Store> = {
  label: "Randomize",
  symbol: "*",
  uid: "hvst.randomize",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
    },
    randomLocation: {
      label: "Random Location",
      type: "bool",
      defaultValue: true,
    },
    randomDirection: {
      label: "Random Direction",
      type: "bool",
      defaultValue: false,
    },
    randomLayer: {
      label: "Random Layer",
      type: "bool",
      defaultValue: false,
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
        randomLocation,
        randomDirection,
        randomLayer,
        gateOffset,
        gateOn,
        gateOff,
      } = helpers.getControlValues();

      function tryPerformRandomize(playheadIndex: number) {
        if (probability / 100 > Math.random()) {
          if (randomLayer || randomLocation) {
            const newLayer = randomLayer
              ? Math.floor(helpers.getNumLayers() * Math.random())
              : helpers.getLayer();
            const newLocation = randomLocation
              ? Math.floor(204 * Math.random())
              : helpers.getHexIndex();
            helpers.warpPlayhead(playheadIndex, newLocation, newLayer);
          }

          if (randomDirection) {
            helpers.modifyPlayhead(playheadIndex, {
              direction: Math.floor(6 * Math.random()),
            });
          }
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0) return;

        if (gateOn + gateOff === 0) {
          tryPerformRandomize(playheadIndex);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformRandomize(playheadIndex);
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

export default RandomizeToken;
