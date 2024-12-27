import rdb from 'rdb';

export class RdbTypeError extends Error {
  readonly __RdbTypeError = true;
  private readonly propertyTraces: [ number | string, any ][] = [];
  context?: unknown;

  constructor (private readonly source: string) {
    super('rdb type error');
  }

  addPropertyTrace (name: number | string, parent) {
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

export function integer (value): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new rdb.RdbTypeError('not integer');
  }
  return value;
}

export function string (value): string {
  if (typeof value !== 'string') {
    throw new rdb.RdbTypeError('not string');
  }
  return value;
}

export function boolean (value): boolean {
  if (typeof value !== 'boolean') {
    throw new rdb.RdbTypeError('not boolean');
  }
  return value;
}

// COMPOSITES

export function optional<V> (mapper: (value) => V): (value) => rdb.Maybe<V>  {
  return (value) => {
    if (rdb.helpers.isEmpty(value)) {
      return undefined;
    } else {
      return mapper(value);
    }
  };
}
