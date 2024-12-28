import rdb from 'rdb'

export function isPresent (value: rdb.Anything): boolean {
  return !isEmpty(value)
}

export function isEmpty (value: rdb.Anything): boolean {
  return value === undefined || value === null
}

export function isObject (value: rdb.Anything): boolean {
  return isPresent(value) && typeof value === 'object'
}

export function isRecord (value: rdb.Anything): boolean {
  return isObject(value) && isPresent(value.id)
}

export function isArray (value: rdb.Anything): boolean {
  return Array.isArray(value)
}

export function tryMap<V> (
  value: rdb.Anything,
  mapper: (value: rdb.Anything) => V
): { error: undefined, value: V } | { error: rdb.RdbTypeError } {
  try {
    return { error: undefined, value: mapper(value) }
  } catch (error) {
    if (error instanceof rdb.RdbTypeError) {
      error.seal(value)
      return { error }
    } else {
      throw error
    }
  }
}

let errorLogger: rdb.Maybe<(error: rdb.Anything) => void> = function (error: rdb.Anything) {
  console.error(error)
  if (typeof error === 'object' && error.context) {
    console.log(error.context)
  }
}

export function setErrorLogger (
  logger: (error: rdb.Anything) => void
) {
  errorLogger = logger
}

export function logError (error: rdb.Anything) {
  errorLogger?.(error)
}

export class ErrorWithContext extends Error {
  context: rdb.Maybe<rdb.SparseList<rdb.Anything>> = undefined
}