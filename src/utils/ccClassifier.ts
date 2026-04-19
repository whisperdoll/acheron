export type MidiCcMode =
  | "absolute"
  | "twosComplement" // 0 to 63 -> 0 to 63, 64 to 127 -> -64 to -1; 1 and 127
  | "binaryOffset" // 0 to 63 -> -64 to -1, 64 to 127 -> 0 to 63 ; 65 and 63
  | "signMagnitude" // msb is sign; 0 to 63 -> 0 to 63, 64 to 127 -> 0 to -63; 1 and 65
  | "unknown";

export function detectRelativeMode(values: number[]): MidiCcMode {
  if (values.length < 10) return "unknown";

  // --- helpers ---
  const uniqueValues = Array.from(new Set(values));
  const numUniqueValues = uniqueValues.length;
  const mean = uniqueValues.reduce((a, b) => a + b, 0) / uniqueValues.length;
  const variance =
    uniqueValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / uniqueValues.length;

  if ((variance < 100 && variance > 5) || numUniqueValues > 20) {
    return "absolute";
  }

  if (variance < 100) {
    // console.log(uniqueValues, variance);
    return "unknown";
  }

  const deltasAbs = deltas(values, decodeAbsolute);
  const deltasTC = deltas(values, decodeTwosComplement);
  const deltasBO = deltas(values, decodeBinaryOffset);
  const deltasSM = deltas(values, decodeSignMagnitude);

  const score = (ds: number[]) => {
    // reward small, consistent movement
    const avg = avgAbs(ds);
    const varr = varianceOf(ds);
    return avg + varr * 0.5;
  };

  const scores: Record<Exclude<MidiCcMode, "unknown">, number> = {
    binaryOffset: score(deltasBO),
    signMagnitude: score(deltasSM),
    twosComplement: score(deltasTC),
    absolute: score(deltasAbs),
  };

  // --- pick lowest score ---
  let best: MidiCcMode = "unknown";
  let bestScore = Infinity;

  for (const [mode, s] of Object.entries(scores)) {
    if (s < bestScore && mode !== "absolute") {
      bestScore = s;
      best = mode as MidiCcMode;
    }
  }

  // console.log(best);
  return best;
}

// --- decoding functions ---

function decodeAbsolute(v: number) {
  return v;
}

// 0 to 63 -> 0 to 63, 64 to 127 -> -64 to -1
function decodeTwosComplement(v: number) {
  if (v < 64) return v;
  else return -((v ^ 0b1111111) + 1);
}

// 0 to 63 -> -64 to -1, 64 to 127 -> 0 to 63
function decodeBinaryOffset(v: number) {
  return v - 64;
}

// msb is sign; 0 to 63 -> 0 to 63, 64 to 127 -> 0 to -63
function decodeSignMagnitude(v: number) {
  if (v < 64) return v;
  else return -(v - 64);
}

export function decodeMidiCc(value: number, mode: MidiCcMode) {
  switch (mode) {
    case "absolute":
      return value;
    case "binaryOffset":
      return decodeBinaryOffset(value);
    case "signMagnitude":
      return decodeSignMagnitude(value);
    case "twosComplement":
      return decodeTwosComplement(value);
    case "unknown":
      throw "shouldnt be decoding this";
  }
}

// --- utilities ---

function deltas(values: number[], decode: (v: number) => number) {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    out.push(decode(values[i]));
  }
  return out;
}

function avgAbs(arr: number[]) {
  return arr.reduce((a, b) => a + Math.abs(b), 0) / arr.length;
}

function varianceOf(arr: number[]) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}
