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

export type StateStoreSubscription<T> = (
  prevState: T | null,
  newState: T
) => void;

type StateStoreSubscriptionFilter<T> = (prevState: T, newState: T) => boolean;

export default class StateStore<StateType extends Record<string, any>> {
  private _values: StateType | null = null;
  private _prevValues: StateType | null = null;
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

  public filters = {
    deepEqual: (
      selector: (state: StateType) => any
    ): StateStoreSubscriptionFilter<StateType> => {
      return (prevState, newState) => {
        if (!prevState) return true;

        return !equal(selector(prevState), selector(newState));
      };
    },
  };

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
    this._prevValues = initialState;

    while (this.queue.length) {
      const { newState, why, resolve, reject } = this.queue.shift()!;

      const resolvedNewState = await resolveMaybeGeneratedPromise(
        newState,
        this._prevValues
      );

      Object.assign(this.values, resolvedNewState);

      if (equal(this._prevValues, this.values)) {
        resolve(this.values);
        this._prevValues = { ...this.values };
        continue;
      }

      DEBUG &&
        why !== "tick" &&
        console.log(
          `setting state bc ${why}`,
          detailedDiff(this._prevValues, this.values)
        );

      resolve(this.values);
      this.notifySubscribers(initialState, this.values);
      this._prevValues = { ...this.values };
    }

    this.busy = false;
  }

  subscribe(
    onUpdate: StateStoreSubscription<StateType>,
    filter?: StateStoreSubscriptionFilter<StateType>
  ): () => void {
    onUpdate(this._prevValues, this.values);

    const subscriptionFn: StateStoreSubscription<StateType> = !filter
      ? onUpdate
      : (prevState, currentState) => {
          // console.log(onUpdate, filter(prevState!, currentState), {
          //   onUpdate,
          //   filter,
          //   prevState,
          //   currentState,
          // });
          if (filter(prevState!, currentState)) {
            onUpdate(prevState, currentState);
          }
        };

    this.subscriptions.push(subscriptionFn);
    return () =>
      this.subscriptions.splice(this.subscriptions.indexOf(subscriptionFn), 1);
  }

  useSubscription(
    onUpdate: StateStoreSubscription<StateType>,
    dependencyArray: any[] = [],
    filter?: StateStoreSubscriptionFilter<StateType>
  ) {
    useEffect(() => {
      // console.log({ onUpdate, dependencyArray, filter });
      return this.subscribe(onUpdate, filter);
    }, dependencyArray);
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
      [setStateValue],
      selector && this.filters.deepEqual(selector)
    );

    return stateValue;
  }

  private notifySubscribers(prevState: StateType, newState: StateType) {
    for (const subscriptionFn of this.subscriptions) {
      subscriptionFn(prevState, newState);
    }
  }
}
