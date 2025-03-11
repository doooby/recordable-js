import rdb from '../dist/rdb.v1.1.js'
import * as t from 'jsr:@std/assert'

const globals = {
  async mock (fn) {
    const originals = {}
    for (const [ name, value ] of Object.entries(globals.properties)) {
      originals[name] = globalThis[name]
      globalThis[name] = value
    }
    try {
      await fn()
    }
    finally {
      globals.state = {}
      for (const name of Object.keys(globals.properties)) {
        globalThis[name] = originals[name]
      }
    }
  },
  getState (property) {
    if (!globals.state[property]) globals.state[property] = {}
    return globals.state[property]
  },
  setState (property, values) {
   const state = globals.getState(property) 
   Object.assign(state, values)
   return state
  },
  state: {},
  properties: { 
    location: {
      origin: 'http://localhost.test',
    },
    async fetch (...args) {
      const state = globals.setState('fetch', {
        args,
      })
      return { 
        ok: state.ok,
        text: () => Promise.resolve(state.text),
        json: () => Promise.resolve(state.json),
      }
    },
  },
}

Deno.test('fetch get with params', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      text: 'hello',
    })
    const fetch = new rdb.Fetch(undefined, '/path', { page: 2 })
    const [ ok, data ] = await fetch.process()
    t.assertExists(fetchState.args)
    t.assertEquals(
      fetchState.args[0].toString(),
      'http://localhost.test/path?page=2'
    )
    t.assertEquals(ok, true)
    t.assertEquals(data, 'hello')
  })
})

Deno.test('fetch get with FormData and params as url search', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
    })
    const fetch = new rdb.Fetch(undefined, '', { page: 2 })
    const formData = new FormData()
    formData.set('search', 'terezie')
    fetch.formData = formData
    await fetch.process()
    t.assertExists(fetchState.args)
    t.assertEquals(
      fetchState.args[0].toString(),
      'http://localhost.test/?search=terezie&page=2'
    )
  })
})

Deno.test('fetch post FormData and params', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
    })
    const fetch = new rdb.Fetch('POST', '', { page: 2 })
    const formData = new FormData()
    formData.set('search', 'terezie')
    fetch.formData = formData
    await fetch.process()
    t.assertExists(fetchState.args)
    t.assertEquals(
      fetchState.args[0].toString(),
      'http://localhost.test/'
    )
    t.assertEquals(fetchState.args[1].body,formData)
    t.assertEquals(formData.get('search'), 'terezie')
    t.assertEquals(formData.get('page'), '2')
  })
})

Deno.test('Fetch.getJson', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: { name: 'terezie' },
    })
    const [ ok, data ] = await rdb.Fetch.getJson({
      url: '/',
      params: { page: 1 },
      transform: (value) => rdb.helpers.map(
        value,
        rdb.record((value) => ({
          name: rdb.property(value, 'name', rdb.string),
        }))
      ),
    })
    t.assertExists(fetchState.args)
    t.assertEquals(
      fetchState.args[0].toString(),
      'http://localhost.test/?page=1'
    )
    t.assertEquals(ok, true)
    t.assertEquals(fetchState.args[1].headers, {
      'Content-Type': 'application/json',
    })
    t.assertEquals(fetchState.args[1].body, undefined)
    t.assertEquals(data, { name: 'terezie' })
  })
})

Deno.test('Fetch.postJson', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      json: { age: 1 },
    })
    const [ ok, data ] = await rdb.Fetch.postJson({
      url: '/',
      params: { page: 2 },
      transform: (value) => rdb.helpers.map(
        value,
        rdb.record((value) => ({
          age: rdb.property(value, 'age', rdb.integer),
        }))
      ),
    })
    t.assertExists(fetchState.args)
    t.assertEquals(
      fetchState.args[0].toString(),
      'http://localhost.test/'
    )
    t.assertEquals(ok, true)
    t.assertEquals(fetchState.args[1].headers, {
      'Content-Type': 'application/json',
    })
    t.assertEquals(fetchState.args[1].body, '{"page":2}')
    t.assertEquals(data, { age: 1 })
  })
})
