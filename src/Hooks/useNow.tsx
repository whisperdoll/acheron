import { useContext } from "react";
import { AppContext } from "../state/AppState";

export default function useNow() {
  const { state, setState } = useContext(AppContext)!;
  return Math.round(state.layers[0].currentTimeMs / 60);
}
