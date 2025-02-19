# recordable-js
rdb.js

Ensures that your data has specific structure. Gives sensible error messages otherwise.

## Is it any good?
[yes](https://news.ycombinator.com/item?id=3067434)

## current status
`v.1.0 ` released with minimal docs.

The simple reason for lack of docs is that while this lib is perfectly usable and functional in it's current shape, the project that uses this is still in early development.

### TS
- deno v2 was not a good choice ATM for a typescript library that was suppose to be usable from node/npm
- therefore the TS code was deprecated

### JS
- released as v.1.0 with JSDoc
- see RecordReader / FetchJsonRecordReader on how to actually use it

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
```
