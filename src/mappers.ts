import rdb from 'rdb';

export class RdbTypeError extends Error {
  readonly __RdbTypeError = true;
  private readonly propertyTraces: [ number | string, rdb.Anything ][] = [];
  context?: unknown;

  constructor (private readonly source: string) {
    super('rdb type error');
  }

  addPropertyTrace (name: number | string, parent: rdb.Object) {
    this.propertyTraces.push([ name, parent ]);
  }

  seal (context: unknown) {
    const props = this.propertyTraces.map(([ prop ]) => prop);
    props.reverse();
    this.message = `${this.message}: ${this.source} at .${props.join('.')}`;
    this.context = context;
  }
}

// TYPES

export function integer (value: rdb.Anything): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new rdb.RdbTypeError('not integer');
  }
  return value;
}

export function string (value: rdb.Anything): string {
  if (typeof value !== 'string') {
    throw new rdb.RdbTypeError('not string');
  }
  return value;
}

export function boolean (value: rdb.Anything): boolean {
  if (typeof value !== 'boolean') {
    throw new rdb.RdbTypeError('not boolean');
  }
  return value;
}

// COMPOSITES

export function optional<V> (
  mapper: (value: rdb.Anything) => V
): (value: rdb.Anything) => rdb.Maybe<V>  {
  return (value) => {
    if (rdb.helpers.isEmpty(value)) {
      return undefined;
    } else {
      return mapper(value);
    }
  };
}

export function property<V> (
  parent: rdb.Object,
  name: number | string,
  mapper: (value: rdb.Anything) => V,
): V {
  try {
    return mapper(parent[name]);
  } catch (error) {
    if (error instanceof rdb.RdbTypeError) {
      error.addPropertyTrace(name, parent);
    }
    throw error;
  }
}

export function record<T> (
  mapper: (value: rdb.Object) => T
): (value: rdb.Anything) => T {
  return (value) => {
    if (!rdb.helpers.isObject(value)) {
      throw new rdb.RdbTypeError('not object');
    }
    return mapper(value);
  };
}

export function list<V> (
  mapper: (value: rdb.Anything) => V
): (value: rdb.Anything) => rdb.List<V> {
  return (value) => {
    if (!rdb.helpers.isArray(value)) {
      throw new rdb.RdbTypeError('not array');
    }
    const array: rdb.List<V> = [];
    for (let i = 0; i < value.length; i += 1) {
      array[i] = rdb.property(value, i, mapper);
    }
    return array;
  };
}

export function sparseList<V> (
  mapper: (value: rdb.Anything) => V
): (value: rdb.Anything) => rdb.SparseList<V> {
  return list(value => optional(mapper)(value))
}

export function tuple<V0, V1> (
  mapper0: (value: rdb.Anything) => V0,
  mapper1: (value: rdb.Anything) => V1,
): (value: rdb.Anything) => [V0, V1] {
  return (value) => {
    if (!Array.isArray(value)) {
      throw new rdb.RdbTypeError('not array');
    }
    if (!rdb.helpers.isArray(value)) {
      throw new rdb.RdbTypeError('not array');
    }
    const item0 = rdb.property(value, 0, mapper0);
    const item1 = rdb.property(value, 1, mapper1);
    return [ item0, item1 ];
  };
}
