import rdb from '../dist/rdb.v1.1.js'
import * as t from 'jsr:@std/assert'

Deno.test('maps optional string', () => {
  const result = rdb.optional(rdb.string)('abc')
  t.assertEquals(result, 'abc')
})

Deno.test('throws rdb type error', () => {
  t.assertThrows(
    () => { rdb.string(null) },
    rdb.RdbTypeError,
    'rdb type error'
  )
})

Deno.test('throws record mapping error', () => {
  const result = rdb.helpers.tryMap(
    ({ number: 'one' }),
    rdb.record((value) => ({
      number: rdb.property(value, 'number', rdb.integer),
    }))
  )
  t.assertIsError(
    result.error,
    rdb.RdbTypeError,
    'rdb type error: not integer at .number'
  )
})

Deno.test('maps nested record', () => {
  const result = rdb.record((value) => ({
    hello: rdb.property(value, 'hello', rdb.string),
    data: rdb.property(value, 'data', rdb.record((value) => ({
      one: rdb.property(value, 'one', rdb.integer),
      two: rdb.property(value, 'two', rdb.tuple(
        rdb.optional(rdb.integer),
        rdb.integer,
      )),
      three: rdb.property(value, 'three', rdb.optional(rdb.string)),
      four: rdb.property(value, 'four', rdb.list(
        rdb.boolean,
      )),
    }))),
  }))(
    {
      hello: 'world',
      data: {
        one: 1,
        two: [ null, 2 ],
        four: [ false, true, true ],
      }
    }
  )
  t.assertEquals(result, {
    hello: 'world',
      data: {
        one: 1,
        two: [ undefined, 2 ],
        three: undefined,
        four: [ false, true, true ],
      }
  })
})

