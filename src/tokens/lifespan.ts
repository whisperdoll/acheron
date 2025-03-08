import { TokenDefinition } from "../Types";

interface Store {
  gateCounter: number;
}

const LifespanToken: TokenDefinition<Store> = {
  label: "Lifespan",
  symbol: "L",
  uid: "hvst.life",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
    },
    amount: {
      label: "Amount",
      type: "int",
      min: -32,
      max: 32,
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
      const { probability, amount, gateOffset, gateOn, gateOff } =
        helpers.getControlValues();

      function tryPerformLife(playheadIndex: number, lifespan: number) {
        if (probability / 100 > Math.random()) {
          helpers.modifyPlayhead(playheadIndex, { lifespan });
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0) return;

        const lifespan = playhead.lifespan + amount;

        if (gateOn + gateOff === 0) {
          tryPerformLife(playheadIndex, lifespan);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformLife(playheadIndex, lifespan);
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

export default LifespanToken;
