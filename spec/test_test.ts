import rdb from "rdb"
import * as t from "jsr:@std/assert";

Deno.test("aaa", () => {
  const result = rdb.optional(rdb.string)('abc');
  t.assertEquals(result, 'abc');
});
