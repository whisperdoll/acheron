import { useEffect, useState } from "react";
import {
  isFunction,
  resolveMaybeGenerated,
  MaybeGenerated,
  MaybePromise,
  MaybeGeneratedPromise,
  resolveMaybeGeneratedPromise,
  isPromise,
} from "../lib/utils";
import equal from "fast-deep-equal/es6";
import rfdc from "rfdc";
import { detailedDiff } from "deep-object-diff";
import env from "../lib/env";

const DEBUG = env("debug");

export type StateStoreSubscription<T> = (
  prevState: T | null,
  newState: T
) => void;

type StateStoreSubscriptionFilter<T> = (prevState: T, newState: T) => boolean;

export default class StateStore<StateType extends Record<string, any>> {
  private _values: StateType | null = null;
  private _prevValues: StateType | null = null;
  private generator: MaybeGeneratedPromise<StateType, []>;
  private initialized = false;
  private subscriptions: StateStoreSubscription<StateType>[] = [];
  private queue: {
    newState: MaybeGeneratedPromise<Partial<StateType>, [StateType]>;
    why: string;
    resolve: (state: StateType) => void;
    reject: (err: string) => void;
  }[] = [];
  private busy: boolean = false;
  private simple: boolean;

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

  constructor(defaults: typeof this.generator, simple?: boolean) {
    this.generator = defaults;
    this.simple = !!simple;

    if (this.simple) {
      this.initializeSync();
    }
  }

  initializeSync(): this {
    let g = this.generator;
    if (isFunction(g)) {
      g = g();
    }

    if (isPromise(g)) {
      throw new Error("generator returned a promise");
    }

    this._values = g;
    this.initialized = true;
    return this;
  }

  async initialize(): Promise<this> {
    let g = this.generator;
    if (isFunction(g)) {
      g = g();
    }

    if (isPromise(g)) {
      this._values = await g;
    } else {
      this._values = g;
    }

    this.initialized = true;
    return this;
  }

  dangerouslyReplaceValues(values: StateType) {
    this._values = values;
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
    while (this.queue.length) {
      const initialState = rfdc()(this.values);
      this._prevValues = initialState;
      const { newState, why, resolve, reject } = this.queue.shift()!;

      const resolvedNewState = await resolveMaybeGeneratedPromise(
        newState,
        this.values
      );

      Object.assign(this.values, resolvedNewState);

      if (equal(this._prevValues, this.values)) {
        resolve(this.values);
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

  useState<T>(selector: (state: StateType) => T, dependencyArray?: any[]): T;
  useState(dependencyArray?: any[]): StateType;
  useState<T>(
    selector?: ((state: StateType) => T) | any[],
    dependencyArray?: any[]
  ) {
    const [stateValue, setStateValue] = useState(() =>
      isFunction(selector) ? selector(this.values) : { ...this.values }
    );

    this.useSubscription(
      (_, newState) => {
        setStateValue(
          isFunction(selector) ? selector(newState) : { ...newState }
        );
      },
      [setStateValue].concat(dependencyArray || []),
      isFunction(selector) ? this.filters.deepEqual(selector) : undefined
    );

    return stateValue;
  }

  private notifySubscribers(prevState: StateType, newState: StateType) {
    for (const subscriptionFn of this.subscriptions) {
      subscriptionFn(prevState, newState);
    }
  }
}
