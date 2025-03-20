export default class Dict {
  static fromArray<KeyType extends string | number | symbol, ValueType>(
    arr: [KeyType, ValueType][]
  ): Record<KeyType, ValueType> {
    const ret: Record<KeyType, ValueType> = {} as Record<KeyType, ValueType>;
    arr.forEach(([key, value]) => {
      ret[key] = value;
    });

    return ret;
  }

  static zip<
    K extends string,
    T1 extends Record<string, any>,
    T2 extends Record<string, any>
  >(o1: Record<K, T1>, o2: Record<K, T2>): Record<K, T1 & T2> {
    const allKeys = Array.from(
      new Set<K>([...Object.keys(o1), ...Object.keys(o2)])
    );

    return Dict.fromArray(allKeys.map((k) => [k, { ...o1[k], ...o2[k] }]));
  }

  static map<
    K extends string | number | symbol,
    V,
    K2 extends string | number | symbol,
    V2
  >(o: Record<K, V>, fn: (key: K, value: V) => [K2, V2]) {
    return Dict.fromArray(
      Object.entries(o).map(([key, value]) => fn(key, value))
    );
  }
}
