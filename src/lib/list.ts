import { isFunction, isNullOrUndefined, splitmix32 } from "./utils";

const sign = (x: number) => (x < 0 ? -1 : x > 0 ? 1 : 0);

export type MaybeWrapped<T> = T | T[];

export default class List {
  static fromGenerator<T>(generator: (i: number) => T, length: number) {
    if (!length) throw new Error("come onn");
    const ret: T[] = new Array(length);
    for (let i = 0; Math.abs(i) < length; i += sign(length)) {
      ret[i] = generator(i);
    }
    return ret;
  }

  static reversed<T>(list: T[]): T[] {
    const newList = this.copy(list);
    newList.reverse();
    return newList;
  }

  static shuffle(
    array: any[],
    rngGenerator: () => number = splitmix32(Date.now())
  ) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      let randomIndex = Math.floor(rngGenerator() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }
  }

  static shuffled<T>(
    array: T[],
    rngGenerator: () => number = splitmix32(Date.now())
  ) {
    const copy = array.slice(0);
    this.shuffle(copy, rngGenerator);
    return copy;
  }

  static shuffledForever<T>(
    source: T[],
    rngGenerator: () => number = splitmix32(Date.now())
  ) {
    const mySource = this.shuffled(source, rngGenerator);
    let counter = 0;

    return () => {
      if (counter === mySource.length) {
        counter = 0;
        this.shuffle(mySource, rngGenerator);
      }

      return mySource[counter++];
    };
  }

  static multiply<T>(source: T[], times: number) {
    const ret = [];
    for (let i = 0; i < times; i++) {
      ret.push(...source);
    }
    return ret;
  }

  static range(opts: number): number[];
  static range(opts: { to: number; stride?: number }): number[];
  static range(opts: { toInclusive: number; stride?: number }): number[];
  static range(opts: { toExclusive: number; stride?: number }): number[];
  static range(opts: { length: number; stride?: number }): number[];
  static range(opts: { from: number; to: number; stride?: number }): number[];
  static range(opts: {
    from: number;
    toInclusive: number;
    stride?: number;
  }): number[];
  static range(opts: {
    from: number;
    toExclusive: number;
    stride?: number;
  }): number[];
  static range(opts: {
    from: number;
    length: number;
    stride?: number;
  }): number[];
  static range(opts: { from: number; stride?: number }): () => number;
  static range(
    opts:
      | number
      | {
          from?: number;
          to?: number;
          toExclusive?: number;
          toInclusive?: number;
          length?: number;
          stride?: number;
        }
  ) {
    if (typeof opts === "number") {
      return this.fromGenerator((i) => i, opts);
    }

    const { from = 0, to, toExclusive, toInclusive, length, stride = 1 } = opts;

    // priority here is arbitrary

    if (!isNullOrUndefined(toExclusive)) {
      let ret = [];
      for (let i = from; i < toExclusive; i += stride) {
        ret.push(i);
      }
      return ret;
    }

    if (!isNullOrUndefined(toInclusive)) {
      let ret = [];
      for (let i = from; i <= toInclusive; i += stride) {
        ret.push(i);
      }
      return ret;
    }

    if (!isNullOrUndefined(to)) {
      let ret = [];
      for (let i = from; i < to; i += stride) {
        ret.push(i);
      }
      return ret;
    }

    if (!isNullOrUndefined(length)) {
      let ret = [];
      for (let i = from, j = 0; j < length; i += stride, j++) {
        ret.push(i);
      }
      return ret;
    }

    // only `from` specified - infinite generator

    let i = from;

    return () => (i += stride);
  }

  static copy<T>(source: T[]) {
    return source.slice(0);
  }

  static withIndexReplaced<T>(
    source: T[],
    i: number,
    newValue: T | ((oldValue: T) => T)
  ) {
    const copy = this.copy(source);
    copy[i] = isFunction(newValue) ? newValue(copy[i]) : newValue;
    return copy;
  }

  static withIndexesReplaced<T>(
    source: T[],
    replacements: Record<
      number,
      MaybeWrapped<T | ((oldValue: T, i: number) => T)>
    >
  ): T[];
  static withIndexesReplaced<T>(
    source: T[],
    indexes: number[],
    newValue: MaybeWrapped<T | ((oldValue: T, i: number) => T)>
  ): T[];
  static withIndexesReplaced<T>(
    source: T[],
    indexesOrReplacements:
      | number[]
      | Record<number, MaybeWrapped<T | ((oldValue: T, i: number) => T)>>,
    newValue?: MaybeWrapped<T | ((oldValue: T, i: number) => T)>
  ): T[] {
    if (Array.isArray(indexesOrReplacements)) {
      const copy = this.copy(source);
      indexesOrReplacements.forEach((i) => {
        const newValueForI = (
          Array.isArray(newValue) ? newValue[i] : newValue
        )!;
        copy[i] = isFunction(newValueForI)
          ? newValueForI(copy[i], i)
          : newValueForI;
      });
      return copy;
    } else {
      const copy = this.copy(source);
      Object.entries(indexesOrReplacements).forEach(([i, newValue]) => {
        const newValueForI = (
          Array.isArray(newValue) ? newValue[i] : newValue
        )!;
        copy[i] = isFunction(newValueForI)
          ? newValueForI(copy[i], i)
          : newValueForI;
      });
      return copy;
    }
  }

  static wrap<T>(value: T | T[]): T[] {
    return Array.isArray(value) ? value : [value];
  }

  static withInserted<T>(
    source: T[],
    newValues: T | T[],
    insertIndex: number
  ): T[] {
    const copy = this.copy(source);
    copy.splice(insertIndex, 0, ...this.wrap(newValues));
    return copy;
  }

  static indexBy<KeyType extends string | number | symbol, ValueType>(
    source: ValueType[],
    keyGenerator: (value: ValueType) => KeyType
  ): Record<KeyType, ValueType> {
    const ret: Record<KeyType, ValueType> = {} as Record<KeyType, ValueType>;
    source.forEach((value) => {
      const key = keyGenerator(value);
      ret[key] = value;
    });

    return ret;
  }

  static without<T>(source: T[], without: T): T[] {
    return source.filter((v) => v !== without);
  }

  static partition<T, U extends T>(
    source: T[],
    fn: (el: T) => el is U
  ): [U[], Exclude<T, U>[]] {
    const left: U[] = [];
    const right: Exclude<T, U>[] = [];

    source.forEach((value) => {
      if (fn(value)) {
        left.push(value);
      } else {
        right.push(value as Exclude<T, U>);
      }
    });

    return [left, right];
  }

  static partition2<T>(source: T[], fn: (el: T) => boolean): [T[], T[]] {
    const left: T[] = [];
    const right: T[] = [];

    source.forEach((value) => {
      if (fn(value)) {
        left.push(value);
      } else {
        right.push(value);
      }
    });

    return [left, right];
  }

  static partitionBy<ValueType, KeyType extends string | symbol | number>(
    source: ValueType[],
    keyGenerator: (value: ValueType) => KeyType
  ): Record<KeyType, ValueType[] | undefined> {
    const ret = {} as Record<KeyType, ValueType[]>;

    source.forEach((value) => {
      const key = keyGenerator(value);
      (ret[key] ||= []).push(value);
    });

    return ret;
  }
}
