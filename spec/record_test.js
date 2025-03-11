import { rdb, globals } from './test_helper.js'
import * as t from 'jsr:@std/assert'

const parsePerson = rdb.record((record) => ({
  id: rdb.property(record, 'id', rdb.integer),
  name: rdb.property(record, 'name', rdb.string),
  age: rdb.property(record, 'age', rdb.optional(rdb.integer)),
}))

Deno.test('Record fetch fails', async () => {
  await globals.mock({ captureLogError: true }, async () => {
    const fetchState = globals.setState('fetch', {
      ok: false,
    })
    const record = new rdb.Record({ url: '/' })
    await record.fetch()
    t.assertExists(fetchState.args)
    t.assertEquals(
      record.state,
      {
        processing: false,
        failReason: 'rdb.invalid_data',
      }
    )
    const logState = globals.getState('errorLogs')
    t.assertExists(logState.calls)
    t.assertEquals(logState.calls.length, 1)
    const [ error ] = logState.calls[0]
    t.assertEquals(error.message, 'rdb.fetch_failed')
  })
})

Deno.test('Record fails to process data', async () => {
  await globals.mock({ captureLogError: true }, async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: () => Promise.reject( new Error('chaos') )
    })
    const record = new rdb.Record({ url: '/' })
    await record.fetch()
    t.assertExists(fetchState.args)
    t.assertEquals(
      record.state,
      {
        processing: false,
        failReason: 'rdb.invalid_data',
      }
    )
    const logState = globals.getState('errorLogs')
    t.assertExists(logState.calls)
    t.assertEquals(logState.calls.length, 1)
    const [ error ] = logState.calls[0]
    t.assertEquals(error.message, 'chaos')
  })
})

Deno.test('Record get person', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: () => Promise.resolve({
        payload: { id: 1, name: 'terka', age: 1 },
      }),
    })
    const record = new rdb.Record({
      url: '/person/1',
      params: { detail: true },
      payloadMapper: parsePerson,
    })
    await record.fetch()
    t.assertExists(fetchState.args)
    const [ url, options ] = fetchState.args
    t.assertEquals(
      url.toString(),
      'http://localhost.test/person/1?detail=true'
    )
    t.assertEquals(
      options,
      {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      },
    )
    t.assertEquals(
      record.state,
      {
        processing: false,
        record: { id: 1, age: 1, name: 'terka' },
      }
    )
  })
})

Deno.test('Record delete person', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: () => Promise.resolve({
        header: { persisted: false },
      }),
    })
    const record = new rdb.Record({
      method: 'delete',
      url: '/person/1',
      params: { dry: true },
    })
    await record.fetch()
    t.assertExists(fetchState.args)
    t.assertEquals(
      fetchState.args[0].toString(),
      'http://localhost.test/person/1'
    )
    t.assertEquals(
      fetchState.args[1],
      {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{"dry":true}'
      },
    )
    t.assertEquals(
      record.state,
      {
        processing: false,
        envelope: {
          failReason: undefined,
          header: { persisted: false },
          payload: undefined,
        },
      }
    )
  })
})

Deno.test('Record fails with envelope reason', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: () => Promise.resolve({
        failReason: 'just_not',
      }),
    })
    const record = new rdb.Record({ url: '/' })
    await record.fetch()
    t.assertExists(fetchState.args)
    t.assertEquals(
      record.state,
      {
        processing: false,
        failReason: 'rdb.envelope_fail',
        envelope: {
          failReason: 'just_not', 
          header: undefined,
          payload: undefined,
        },
      }
    )
  })
})

Deno.test('Record fails on header', async () => {
  await globals.mock({ captureLogError: true }, async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: () => Promise.resolve({
        header: { persisted: 'nope' },
      }),
    })
    const record = new rdb.Record({
      method: 'patch',
      url: '/',
      headerMapper: rdb.record(value => ({
        persisted: rdb.property(value, 'persisted', rdb.boolean),
      }))
    })
    await record.fetch()
    t.assertExists(fetchState.args)
    t.assertEquals(
      record.state,
      {
        processing: false,
        failReason: 'rdb.invalid_data'
      }
    )
    const logState = globals.getState('errorLogs')
    t.assertExists(logState.calls)
    t.assertEquals(logState.calls.length, 1)
    const [ error ] = logState.calls[0]
    t.assertEquals(error.message, 'rdb.type : not boolean at .header.persisted')
  })
})

