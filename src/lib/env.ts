import { tryParseFloat, tryParseInt } from "./utils";

interface Env {
  debug: boolean;
  gitHash: string;
}

const envSpec = {
  debug: "bool",
  gitHash: "string",
} as const satisfies Record<keyof Env, keyof TypeMap>;

function ANGRY_SNAKE_CASEIFY(s: string) {
  return s.replace(/([a-z])([A-Z])/, "$1_$2").toUpperCase();
}

interface TypeMap {
  bool: boolean;
  int: number;
  decimal: number;
  string: string;
}

const typeMappers: { [K in keyof TypeMap]: (value: any) => TypeMap[K] } = {
  bool: (value) => ["true", "TRUE", "1", 1, true].includes(value),
  decimal: (value) => tryParseFloat(value, 0),
  int: (value) => tryParseInt(value, 0),
  string: (value) =>
    typeof value?.toString === "function"
      ? value.toString()
      : JSON.stringify(value),
};

export default function env<K extends keyof Env>(
  key: K
): TypeMap[(typeof envSpec)[K]] {
  return typeMappers[envSpec[key]](
    import.meta.env[`VITE_${ANGRY_SNAKE_CASEIFY(key)}`]
  );
}
