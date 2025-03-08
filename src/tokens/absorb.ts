import { TokenDefinition, TokenStore } from "../Types";

interface Store extends TokenStore {
  gateCounter: number;
}

const AbsorbToken: TokenDefinition<Store> = {
  label: "Absorb",
  symbol: "x",
  uid: "whisperdoll.absorb",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
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
      const { probability, gateOffset, gateOn, gateOff } =
        helpers.getControlValues();

      function tryPerformAbsorb(playheadIndex: number) {
        if (probability / 100 > Math.random()) {
          helpers.modifyPlayhead(playheadIndex, {
            age: playheads[playheadIndex].lifespan,
          });
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0) return;

        if (gateOn + gateOff === 0) {
          tryPerformAbsorb(playheadIndex);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformAbsorb(playheadIndex);
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

export default AbsorbToken;
