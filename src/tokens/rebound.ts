import { TokenDefinition } from "../Types";

interface Store {
  gateCounter: number;
}

const ReboundToken: TokenDefinition<Store> = {
  label: "Rebound",
  symbol: ">",
  uid: "whisperdoll.rebound",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
    },
    direction: {
      label: "Direction",
      type: "direction",
      defaultValue: 0,
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
      const { probability, direction, gateOffset, gateOn, gateOff } =
        helpers.getControlValues();

      function tryPerformRebound(playheadIndex: number) {
        if (probability / 100 > Math.random()) {
          helpers.modifyPlayhead(playheadIndex, { direction });
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0) return;

        if (gateOn + gateOff === 0) {
          tryPerformRebound(playheadIndex);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformRebound(playheadIndex);
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

export default ReboundToken;
