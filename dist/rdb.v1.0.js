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
* @typedef {Object} RecordReaderOptions
* @property {string} resourcePath
* @property {MapperFunction} headerMapper
* @property {MapperFunction} payloadMapper
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

class RecordReader {
  state = {
    processing: false,
  }

  onChange = undefined

  resourcePath = undefined
  headerMapper = undefined
  payloadMapper = undefined

  /**
   * @param {RecordReaderOptions} options
   */
  constructor (options) {
    this.resourcePath = options.resourcePath
    this.headerMapper = options.headerMapper
    this.payloadMapper = options.payloadMapper
  }

  async fetch () {
    return await Promise.resolve('rdb: fetch not implemented')
  }

  async read () {
    if (this.state.processing) return
    this._setState({ processing: true })

    let data = undefined
    try {
      data = await this.fetch()
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
      envelope,
      processing: false,
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

class FetchJsonRecordReader extends RecordReader {

  static fetch = globalThis.fetch

  baseUrlPath = undefined
  body = undefined
  cookie = undefined

  constructor (options) {
    super(options)
    this.baseUrlPath = options.baseUrlPath
    this.body = options.body
    this.cookie = options.cookie
  }

  async fetch () {
    const rawResponse = await FetchJsonRecordReader.fetch(
      `${this.baseUrlPath}${this.resourcePath}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: this.cookie?.length ? this.cookie : '',
        },
        body: this.body ?? '',
      },
    )
    return await rawResponse.json()
  }
}

const rdb = {
  helpers,
  RdbTypeError,
  RecordReader,
  FetchJsonRecordReader,

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

    /**
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
    helpers.property(record, name, mapper)
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
    return list(value => optional(mapper)(value))
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

