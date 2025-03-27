import { TokenDefinition } from "../Types";

interface Store {
  gateCounter: number;
}

const NoteToken: TokenDefinition<Store> = {
  label: "Note",
  symbol: "♪",
  uid: "whisperdoll.note",
  controls: {
    probability: {
      label: "Probability",
      type: "int",
      min: 0,
      max: 100,
      defaultValue: 100,
    },
    triad: {
      label: "Triad",
      type: "triad",
    },
    transpose: {
      label: "Transpose",
      type: "int",
      min: -36,
      max: 36,
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
    velocity: {
      inherit: "layer.velocity",
    },
    emphasis: {
      inherit: "layer.emphasis",
    },
    noteLength: {
      inherit: "layer.noteLength",
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
        gateOffset,
        gateOn,
        gateOff,
        velocity,
        emphasis,
        noteLength,
        ghostBeats,
        triad,
        transpose,
      } = helpers.getControlValues();

      let hasPerformed = false;

      function tryPerformNote(playheadIndex: number) {
        if (probability / 100 > Math.random()) {
          const durationType = helpers.getLayerValue("tempoSync")
            ? "beat"
            : "ms";
          helpers.playTriad(
            helpers.getHexIndex(),
            triad,
            noteLength * (durationType === "ms" ? 1000 : 1),
            durationType,
            helpers.getCurrentBeat() === 0 ? emphasis : velocity,
            transpose
          );
          hasPerformed = true;
        }
      }

      playheads.forEach((playhead, playheadIndex) => {
        if (playhead.age === 0 || hasPerformed) return;

        if (gateOn + gateOff === 0) {
          tryPerformNote(playheadIndex);
        } else {
          if (
            store.gateCounter >= gateOffset + gateOff ||
            store.gateCounter < gateOffset
          ) {
            tryPerformNote(playheadIndex);
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

export default NoteToken;
