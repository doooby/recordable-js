import rdb from 'rdb';

export function isPresent (value: rdb.Anything): boolean {
  return !isEmpty(value);
}

export function isEmpty (value: rdb.Anything): boolean {
  return value === undefined || value === null;
}

export function isObject (value: rdb.Anything): boolean {
  return isPresent(value) && typeof value === 'object';
}

export function isRecord (value: rdb.Anything): boolean {
  return isObject(value) && isPresent(value.id);
}

export function isArray (value: rdb.Anything): boolean {
  return Array.isArray(value);
}
