import rdb from 'rdb';

export function isPresent (value): boolean {
  return !isEmpty(value);
}

export function isEmpty (value): boolean {
  return value === undefined || value === null;
}

export function isObject (value): boolean {
  return isPresent(value) && typeof value === 'object';
}

export function isRecord (value): boolean {
  return isObject(value) && isPresent(value.id);
}
