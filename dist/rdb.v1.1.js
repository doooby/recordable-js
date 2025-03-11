/**
 * RELEASE rdb.v1.1.js
 * Recordable.js
 * https://raw.githubusercontent.com/doooby/recordable-js/refs/heads/main/dist/rdb.v1.1.js
 */

/**
 * @typedef {any} SomeValue
 * @typedef {function(SomeValue): SomeValue} MapperFunction
*
* @typedef {Object} RecordReaderState
* @property {boolean} processing
* @property {Object} [envelope]
* @property {SomeValue} [envelope.header]
* @property {SomeValue} [envelope.payload]
* @property {SomeValue} [envelope.failReason]
* @property {SomeValue} [record]
* @property {string} [failReason]
* @property {Error} [error]
*
*/

const helpers = {

  /**
   * @param {SomeValue} value
   * @returns {boolean}
   */
  isPresent (value) {
    return !rdb.helpers.isEmpty(value)
  },

  /**
   * @param {SomeValue} value
   * @returns {boolean}
   */
  isEmpty (value) {
    return value === undefined || value === null
  },

  /**
   * @param {SomeValue} value
   * @returns {boolean}
   */
  isObject (value) {
    return rdb.helpers.isPresent(value) && typeof value === 'object'
  },

  /**
   * @param {SomeValue} value
   * @returns {boolean}
   */
  isRecord (value) {
    return rdb.helpers.isObject(value) && rdb.helpers.isPresent(value.id)
  },

  /**
   * @param {SomeValue} value
   * @returns {boolean}
   */
  isArray (value) {
    return Array.isArray(value)
  },

  /**
   * @param {eny} error
   * @returns {boolean}
   */
  isRdbTypeError (error) {
    return rdb.helpers.isObject(error) && '__RdbTypeError' in error
  },

  /**
   *
   * @param {SomeValue} value
   * @param {MapperFunction} mapper
   * @returns {any}
   */
  map (value, mapper) {
    try {
      return mapper(value)
    } catch (error) {
      if (rdb.helpers.isRdbTypeError(error)) error.seal(value)
      throw error
    }
  },

  /**
   *
   * @param {SomeValue} value
   * @param {MapperFunction} mapper
   * @returns {{ error: eny, value: any }}
   */
  tryMap (value, mapper) {
    try {
      return { error: undefined, value: mapper(value) }
    } catch (error) {
      if (rdb.helpers.isRdbTypeError(error)) {
        error.seal(value)
        return { error }
      } else {
        throw error
      }
    }
  },

  logError (error) {
    console.error(error)
    if (rdb.helpers.isObject(error) && error.context) {
      console.log(error.context)
    }
  },

  ErrorWithContext: class ErrorWithContext extends Error {
    context = undefined
  }
}

class RdbTypeError extends Error {
  __RdbTypeError = true
  propertyTraces= []
  source = undefined
  context = undefined

  constructor (source) {
    super('rdb type error')
    this.source = source
  }

  addPropertyTrace (name, record) {
    this.propertyTraces.push([ name, record ])
  }

  seal (context) {
    const props = this.propertyTraces.map(([ prop ]) => prop)
    props.reverse()
    this.message = `${this.message}: ${this.source} at .${props.join('.')}`
    this.context = [ context ]
  }
}

class Fetch {
  constructor (method, url, params, transform) {
    this.method = method || 'GET'
    this.url = url instanceof URL ? url : new URL(url, location.origin)
    this._headers = undefined
    this._formData = undefined
    this._params = params || undefined
    this.includeCredentials = undefined
    this.transformRequestBody = undefined
    this._requestBody = undefined
    this.transformResult = undefined
  }

  get headers () {
    if (!this._headers) this._headers = {}
    return this._headers
  }

  set headers (value) {
    this._headers = value
  }

  get formData () {
    if (!this._formData) this._formData = new FormData()
    return this._formData
  }

  set formData (value) {
    this._formData = value
  }

  get params () {
    if (!this._params) this._params = {}
    return this._params
  }

  set params (value) {
    this._params = value
  }

  tap (withFn) {
    withFn(this)
    return this
  }

  setHeader (name, value) {
    this.headers[name] = value
    return this
  }

  setParam (name, value) {
    this.params[name] = value
    return this
  }

  isGet () {
    return this.method.toUpperCase() === 'GET'

  }

  async process () {
    const isGet = this.isGet()
    if (isGet) {
      if (this.formData) Fetch.appendFormDataToUrl(this.url, this.formData)
      if (this.params) Fetch.appendParamsToUrl(this.url, this.params)
    } else if (this.transformRequestBody) {
      this._requestBody = this.transformRequestBody()
    } else if (this.params) {
      Fetch.appendParamsToFormData(this.formData, this.params)
    }

    const body = isGet ? undefined : ( this._requestBody || this._formData )

    const buildOptions = {
      method: this.method,
      credentials: (this.includeCredentials ? 'include' : undefined),
      headers: this.headers,
      body,
    }

    let response = undefined
    try {
      response = await fetch(this.url, buildOptions)
      if (response.ok) {
        const result = this.transformResult
          ? await this.transformResult(response)
          : await response.text()
        return [ true, result ]
      } else {
        Fetch.logFail(undefined, response, this)
        return [ false, undefined ]
      }
    } catch (error) {
      Fetch.logFail(error, response, this)
      return [ false, undefined ]
    }
  }

  static logFail (error, response, client) {
    console.log(response, client)
    if (error) console.error(error)
  }

  static appendFormDataToUrl (url, formData) {
    for (const [name, value] of formData.entries()) {
      if (typeof value === 'string') url.searchParams.append(name, value)
    }
  }

  static appendParamsToUrl (url, params) {
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.append(name, value)
    }
  }

  static appendParamsToFormData (formData, params) {
    for (const [name, value] of Object.entries(params)) {
      formData.set(name, value)
    }
  }

  static async get ({ url, formData, params, tap }) {
    const client = new Fetch('GET', url, params)
    if (formData) client.formData = formData
    tap?.(client)
    return await client.process()
  }

  static async getJson ({ url, params, tap, transform }) {
    const client = new Fetch('GET', url, params )
    client.setHeader('Content-Type', 'application/json')
    client.transformResult = async (response) => {
      const json = await response.json()
      return transform ? await transform(json) : json
    }
    return await client.process()
  }

  static async post ({ url, formData, params, tap }) {
    const client = new Fetch('POST', url, params)
    if (formData) client.formData = formData
    tap?.(client)
    return client.process()
  }

  static async postJson ({ url, params, tap, transform }) {
    const client = new Fetch('POST', url)
    client.setHeader('Content-Type', 'application/json')
    client.transformRequestBody = () => params ? JSON.stringify(params) : undefined
    client.transformResult = async (response) => {
      const json = await response.json()
      return transform ? await transform(json) : json
    }
    return await client.process()
  }
}

class RecordReader {
  state = {
    processing: false,
  }

  constructor ({
    method,
    url,
    includeCredentials = true,
    params,
    tap,
    headerMapper,
    payloadMapper,
    onChange,
  }) {
    this.client = new Fetch(method, url, params)
    this.client.includeCredentials = includeCredentials
    this,client.setHeader('Content-Type', 'application/json')
    if (!this.client.isGet()) {
      this,client.transformRequestBody = () =>  {
        return this.client.params
          ? JSON.stringify(this.client.params)
          : undefined
      }
    }
    this.headerMapper = headerMapper
    this.payloadMapper = payloadMapper
    this.onChange = onChange
  }

  async read () {
    if (this.state.processing) return
    this._setState({ processing: true })

    let data = undefined
    try {
      const [ ok, result ] = await this.client.process()
      if (!ok) {
        this.finalizeReadOnError(undefined, 'rdb.fetch_failed')
        return
      } else {
        data = result
      }
    } catch (error) {
      this.finalizeReadOnError(error, 'rdb.fetch_failed')
      return
    }

    const envelope = rdb.helpers.tryMap(data, rdb.record((value) => ({
      header: rdb.property(value, 'header', rdb.optional(rdb.record(
        this.headerMapper || (value => value)
      ))),
      payload: rdb.property(value, 'payload', rdb.optional(rdb.record(value => value))),
      failReason: rdb.property(value, 'failReason', rdb.optional(rdb.string)),
    })))

    if (envelope.error) {
      this.finalizeReadOnError(envelope.error, 'rdb.envelope_invalid')
      return
    }

    if (envelope.value.failReason) {
      const error = new rdb.helpers.ErrorWithContext('rdb: envelope fail')
      error.context = [ this ]
      this.finalizeReadOnError(error, 'rdb.envelope_fail', envelope.value)
      return
    }

    if (!this.payloadMapper) {
      const error = new rdb.helpers.ErrorWithContext('rdb: missing payload mapper')
      error.context = [ this ]
      this.finalizeReadOnError(error, 'rdb.missing_mapper')
      return
    }

    const record = rdb.helpers.tryMap(envelope.value.payload, this.payloadMapper)
    if (record.error) {
      this.finalizeReadOnError(record.error, 'rdb.payload_invalid')
    } else {
      this._setState({
        processing: false,
        record: record.value,
      })
    }
  }

  _setState (newState) {
    const previousState = this.state
    this.state = newState
    this.onChange?.(newState, previousState)
  }

  finalizeReadOnError (error, failReason, envelope) {
    rdb.helpers.logError(error)
    const newState = {
      processing: false,
      envelope,
      failReason,
    }
    if (error instanceof Error) {
      newState.error = error
    } else {
      newState.error = new Error('rdb: unsuported type of error')
    }
    this._setState(newState)
  }

}

const rdb = {
  helpers,
  RdbTypeError,
  Fetch,
  RecordReader,

  /**
   * @param {SomeValue} value
   * @returns {number}
   */
  integer (value) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new rdb.RdbTypeError('not integer')
    }
    return value
  },

   /**
   * @param {SomeValue} value
   * @returns {string}
   */
  string (value) {
    if (typeof value !== 'string') {
      throw new rdb.RdbTypeError('not string')
    }
    return value
  },

   /**
   * @param {SomeValue} value
   * @returns {boolean}
   */
  boolean (value) {
    if (typeof value !== 'boolean') {
      throw new rdb.RdbTypeError('not boolean')
    }
    return value
  },

    /*
  * @param {SomeValue} record
  * @param {number|string} name
  * @param {MapperFunction} mapper
  * @returns {SomeValue}
  */
  property (record, name, mapper) {
    try {
      return mapper(record[name])
    } catch (error) {
      if (rdb.helpers.isRdbTypeError(error)) {
        error.addPropertyTrace(name, record)
      }
      throw error
    }
  },

  /**
   * @param {SomeValue} record
   * @param {number|string} name
   * @param {MapperFunction} mapper
   * @returns {SomeValue}
   */
  dig (record, name, mapper) {
    return rdb.property(record, name, mapper)
  },

  /**
   * @param {MapperFunction} mapper
   * @returns {MapperFunction}
   */
  optional (mapper) {
    return (value) => {
      if (rdb.helpers.isEmpty(value)) {
        return undefined
      } else {
        return mapper(value)
      }
    }
  },

  /**
   * @param {MapperFunction} mapper
   * @returns {MapperFunction}
   */
  record (mapper) {
    return (value) => {
      if (!rdb.helpers.isObject(value)) {
        throw new rdb.RdbTypeError('not object')
      }
      return mapper(value)
    }
  },

  /**
   * @param {MapperFunction} mapper
   * @returns {MapperFunction}
   */
  list (mapper) {
    return (value) => {
      if (!rdb.helpers.isArray(value)) {
        throw new rdb.RdbTypeError('not array')
      }
      const array = []
      for (let i = 0; i < value.length; i += 1) {
        array[i] = rdb.property(value, i, mapper)
      }
      return array
    }
  },

  /**
   * @param {MapperFunction} mapper
   * @returns {MapperFunction}
   */
  sparseList (mapper) {
    return rdb.list(value => rdb.optional(mapper)(value))
  },

  /**
   * @param {MapperFunction} mapper0
   * @param {MapperFunction} mapper1
   * @returns {MapperFunction}
   */
  tuple (mapper0, mapper1) {
    return (value) => {
      if (!Array.isArray(value)) {
        throw new rdb.RdbTypeError('not array')
      }
      if (!rdb.helpers.isArray(value)) {
        throw new rdb.RdbTypeError('not array')
      }
      const item0 = rdb.property(value, 0, mapper0)
      const item1 = rdb.property(value, 1, mapper1)
      return [ item0, item1 ]
    }
  }

}

export default rdb
