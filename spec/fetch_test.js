import { rdb, globals } from './test_helper.js'
import * as t from 'jsr:@std/assert'

Deno.test('Fetch get with params', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      text: () => Promise.resolve('hello'),
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

Deno.test('Fetch get with FormData and params as url search', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      text: () => Promise.resolve(),
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

Deno.test('Fetch post FormData and params', async () => {
  await globals.mock(async () => {
    const fetchState = globals.setState('fetch', {
      ok: true,
      text: () => Promise.resolve(),
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
      json: () => Promise.resolve({ name: 'terezie' }),
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
      json: () => Promise.resolve({ age: 1 }),
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

