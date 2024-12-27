export type Maybe<V> = undefined | V;

export type Map<V> = Record<string, Maybe<V>>;
export type SparseList<V> = Array<Maybe<V>>;
export type List<V> = Array<V>;

export type Params = Map<unknown>;
