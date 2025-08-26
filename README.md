# recordable-js
rdb.js

Ensure your data types are what is declared. If there is a missmatch, sensible tracing error messages are produced.

## Is it any good?
- [yes](https://news.ycombinator.com/item?id=3067434)
- ensures data typing with sensible errors
- API client (minimal wraper arround native fetch)
- opinionated REST API client (json, metadata, HTML form data, custom params data)

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

// use helpers
const task = rdb.helpers.map(mapTask(null)) // throws the sealed error
const { error, value } = rdb.helpers.tryMap(mapTask(null))

// or seal the error yourself
try {
  mapTask(null)
} catch (error) {
  if (rdb.helpers.isRdbTypeError(error)) error.seal(value)
  console.log(error.message, error.context)
}

// hits the server with path "/summary.html?search=a&page=2"
// say there is a from with `<input name="search" value="a" />`
const [ ok, data ] = await rdb.Fetch.get({
  url: 'http://localhost:3000/summary.html',
  formData: new FormData(form), 
  params: { page: 2 },
})

// hits server with DELETE method at "/book/1"
const request = new rdb.Fetch('delete', '/book/1')
// OOP based approach to set up the request
request.setHeader('Content-Type', 'whatever')
const [ ok, data ] = await request.process()

// helpers that mimic native "fetch"
// hides common settings, here content-type header
// transforms and assert the answer; otherwise `ok = false`
const [ ok, data ] = await rdb.Fetch.postJson({
  url: new URL('book/2', window.location.origin),
  method: 'patch',
  includeCredentials: true,
  params: { title: 'palindrom' },
  transform: mapTask,
})

// higher order concept that allows for metadata and statefull control
// `record.state` = `{ isProcessing, failReason, record, envelope }`
const record = new rdb.Record({
  url: '/tasks',
  params: { page: 2 },
  payloadMapper (value) {
    return rdb.record((value) => ({
      page: rdb.property(value, 'page', rdb.integer),
      total: rdb.property(value, 'total', rdb.integer),
      list: rdb.property(value, 'list', rdb.list(mapTask)),
    })(value)
  },
})
await record.read // afterwards `state.isProcessing =  false`
console.log(record.state.record) // prints: { page: 2, total: 42, list: [ { id: 1, ...}, ... ] }
// expected server response is JSON:
// { header: { <optional-meta-data> }, payload: { page: 2, total: 42, list: [ ... ], failReason: undefined }
// where both header and failReason are optional metadata
```
