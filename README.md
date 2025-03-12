# recordable-js
rdb.js

Ensures that your data has specific structure. Gives sensible error messages otherwise.

## Is it any good?
[yes](https://news.ycombinator.com/item?id=3067434)

## current status
`v.1.1 ` released with minimal docs.

- deno v2 was not a good choice ATM for a typescript library that was suppose to be usable from node/npm
- therefore the TS code was removed

### JS
- released as v.1.1 with JSDoc
- tested with Deno tests

### note on docs
The simple reason for lack of docs is that while this lib is perfectly usable and functional in it's current shape, the project that uses this is still in early development.

### minimal showcase
```js
import rdb from '%root/vendor/recordable'

export function mapTask (value) {
  return rdb.record((value) => ({
    id: rdb.dig(value, 'id', rdb.integer),
    task: rdb.dig(value, 'task', rdb.optional(rdb.string)),
    tasks: rdb.dig(value, 'tasks', rdb.optional(rdb.sparseList(
      rdb.string
    ))),
    start_at: rdb.dig(value, 'start_at', rdb.optional(rdb.string)),
    end_at: rdb.dig(value, 'end_at', rdb.optional(rdb.string)),
    message: rdb.dig(value, 'message', rdb.optional(rdb.string)),
  }))(value)
}

const [ ok, data ] = await rdb.Fetch.get({
  url: 'http://localhost:3000/summary.html',
  formData: new FormData(form), // say there is <input name="search" value="a" />
  params: { page: 2 },
})
// hits the server with path "/summary.html?search=a&page=2"

const client = new rdb.Fetch('delete', '/book/1')
client.setHeader('Content-Type', 'whatever')
const [ ok, data ] = await client.process()

const [ ok, data ] = await rdb.Fetch.postJson({
  url: new URL('book/2', window.location.origin),
  method: 'patch',
  includeCredentials: true,
  params: { title: 'palindrom' },
  transform: mapTask,
})

const record = new rdb.Record({
  url: '/tasks',
  params: { page: 2 },
  payloadMapper (payload) {
    return rdb.record((value) => ({
      page: rdb.property(value, 'page', rdb.integer),
      total: rdb.property(value, 'total', rdb.integer),
      list: rdb.property(value, 'list', rdb.list(mapTask)),
    })
  },
})
await record.read
console.log(record.state.record) // prints: { page: 2, total: 42, list: [ { id: 1, ...}, ... ] }
// expected server response is JSON:
// { header: { <optional-meta-data> }, payload: { page: 2, total: 42, list: [ ... ], failReason: undefined }
// where both header and failReason are optional - servers as meta-data
```
