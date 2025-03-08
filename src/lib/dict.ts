export default class Dict {
  static fromArray<KeyType extends string, ValueType>(
    arr: [KeyType, ValueType][]
  ): Record<KeyType, ValueType> {
    const ret: Record<KeyType, ValueType> = {} as Record<KeyType, ValueType>;
    arr.forEach(([key, value]) => {
      ret[key] = value;
    });

    return ret;
  }
}
