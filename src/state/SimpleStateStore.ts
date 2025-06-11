import equal from "fast-deep-equal/es6";
import AppState from "../state/AppState";

type Subscription<T> = (prevState: T | null, newState: T) => void;
type SubscriptionFilter<T> = (prevState: T, newState: T) => boolean;

export default class SimpleStateStore<StateType> {
  private _values: StateType;

  public filters = {
    deepEqual: (
      selector: (state: StateType) => any
    ): SubscriptionFilter<StateType> => {
      return (prevState, newState) => {
        if (!prevState) return true;

        return !equal(selector(prevState), selector(newState));
      };
    },
  };

  constructor(initialValue: StateType) {
    this._values = initialValue;
  }

  public get values(): StateType {
    return this._values;
  }

  public set(newState: StateType) {
    this._values = newState;
  }
}
