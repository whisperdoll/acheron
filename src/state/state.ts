import { useEffect, useState } from "react";
import {
  isFunction,
  resolveMaybeGenerated,
  MaybeGenerated,
  MaybePromise,
  MaybeGeneratedPromise,
  resolveMaybeGeneratedPromise,
} from "../lib/utils";
import equal from "fast-deep-equal/es6";
import rfdc from "rfdc";
import { detailedDiff } from "deep-object-diff";

const DEBUG = true;

export type StateStoreSubscription<T> = (prevState: T, newState: T) => void;

export default class StateStore<StateType extends Record<string, any>> {
  private _values: StateType | null = null;
  private generator: StateType | (() => StateType) | (() => Promise<StateType>);
  private initialized = false;
  private subscriptions: StateStoreSubscription<StateType>[] = [];
  private queue: {
    newState: MaybeGeneratedPromise<Partial<StateType>, [StateType]>;
    why: string;
    resolve: (state: StateType) => void;
    reject: (err: string) => void;
  }[] = [];
  private busy: boolean = false;

  constructor(defaults: typeof this.generator) {
    this.generator = defaults;
  }

  async initialize() {
    if (isFunction(this.generator)) {
      this._values = await Promise.resolve(this.generator());
    } else {
      this._values = this.generator;
    }

    this.initialized = true;
  }

  get values(): StateType {
    if (!this.initialized) throw new Error("must initialize first");

    return this._values as StateType;
  }

  set(
    newState: MaybeGeneratedPromise<Partial<StateType>, [StateType]>,
    why: string
  ): Promise<StateType> {
    return new Promise((resolve, reject) => {
      this.queue.push({ newState, why, resolve, reject });
      if (!this.busy) {
        this.busy = true;
        this.processNextItemInQueue();
      }
    });
  }

  async processNextItemInQueue() {
    const initialState = rfdc()(this.values);
    let prevState = initialState;

    while (this.queue.length) {
      const { newState, why, resolve, reject } = this.queue.shift()!;

      const resolvedNewState = await resolveMaybeGeneratedPromise(
        newState,
        prevState
      );

      Object.assign(this.values, resolvedNewState);

      if (equal(prevState, this.values)) {
        // console.log("state equal so skipping callbacks");
        resolve(this.values);
        prevState = this.values;
        continue;
      }

      DEBUG &&
        console.log(
          `setting state bc ${why}`,
          detailedDiff(prevState, this.values)
        );

      resolve(this.values);
      this.notifySubscribers(initialState, this.values);
      prevState = this.values;
    }

    this.busy = false;
  }

  subscribe(onUpdate: StateStoreSubscription<StateType>): () => void {
    this.subscriptions.push(onUpdate);
    return () =>
      this.subscriptions.splice(this.subscriptions.indexOf(onUpdate), 1);
  }

  useSubscription(
    onUpdate: StateStoreSubscription<StateType>,
    dependencyArray: any[] = [],
    comparator?: (state: StateType) => any
  ) {
    useEffect(
      () =>
        this.subscribe((prevState, state) => {
          if (comparator) {
            // console.log(">>>>", comparator(prevState), comparator(state));
          }
          if (
            (comparator && !equal(comparator(prevState), comparator(state))) ||
            !comparator
          ) {
            onUpdate(prevState, state);
          }
        }),
      dependencyArray
    );
  }

  useState<T>(selector: (state: StateType) => T): T;
  useState(): StateType;
  useState<T>(selector?: (state: StateType) => T) {
    const [stateValue, setStateValue] = useState(() =>
      selector ? selector(this.values) : { ...this.values }
    );

    this.useSubscription(
      (_, newState) => {
        setStateValue(selector ? selector(newState) : { ...newState });
      },
      [setStateValue]
    );

    return stateValue;
  }

  private notifySubscribers(prevState: StateType, newState: StateType) {
    for (const subscriptionFn of this.subscriptions) {
      subscriptionFn(prevState, newState);
    }
  }
}
