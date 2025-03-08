import { TokenDefinition } from "../Types";

interface Store {
  gateCounter: number;
}

const SkipToken: TokenDefinition<Store> = {
  label: "Skip",
  symbol: "K",
  uid: "whisperdoll.skip",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
    },
    skipAmount: {
      label: "Skip Amount",
      type: "int",
      min: -16,
      max: 16,
      defaultValue: 2,
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
      const { probability, skipAmount, gateOffset, gateOn, gateOff } =
        helpers.getControlValues();

      function tryPerformSkip(playheadIndex: number) {
        if (probability / 100 > Math.random()) {
          helpers.skipPlayhead(
            playheadIndex,
            playheads[playheadIndex].direction,
            skipAmount
          );
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0) return;

        if (gateOn + gateOff === 0) {
          tryPerformSkip(playheadIndex);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformSkip(playheadIndex);
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

export default SkipToken;
