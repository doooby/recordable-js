import rdb from 'rdb'

export interface RecordReaderState<R extends rdb.Object> {
  processing: boolean
  envelope?: {
      header: rdb.Maybe<rdb.Object>
      payload: rdb.Maybe<rdb.Object>
      failReason: rdb.Maybe<string>
  }
  record?: R
  failReason?: string
  error?: Error
}

export interface RecordReaderOptions<R> {
  resourcePath?: string
  headerMapper?: () => R
  payloadMapper?: () => R
}

export class RecordReader<R extends rdb.Object> {

  state: RecordReaderState<R> = {
    processing: false,
  }

  onChange: rdb.Maybe<(
    newState: RecordReaderState<R>,
    previousState: RecordReaderState<R>
  ) => void> = undefined

  resourcePath: rdb.Maybe<string> = undefined
  headerMapper: rdb.Maybe<() => R> = undefined
  payloadMapper: rdb.Maybe<() => R> = undefined

  constructor (options: RecordReaderOptions<R>) {
    this.resourcePath = options.resourcePath
    this.headerMapper = options.headerMapper
    this.payloadMapper = options.payloadMapper
  }

  async fetch (): Promise<rdb.Anything> {
    return await Promise.resolve('rdb: fetch not implemented')
  }

  async read () {
    if (this.state.processing) return
    this._setState({ processing: true })

    let data: rdb.Anything = undefined
    try {
      data = await this.fetch()
    } catch (error: rdb.Anything) {
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

  _setState (newState: RecordReaderState<R>) {
    const previousState = this.state
    this.state = newState
    this.onChange?.(newState, previousState)
  }

  finalizeReadOnError (
    error: rdb.Anything,
    failReason: string,
    envelope?: RecordReaderState<R>['envelope']
  ) {
    rdb.helpers.logError(error)
    const newState: RecordReaderState<R> = {
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

export interface FetchJsonRecordReaderOptions<R> {
  baseUrlPath?: string
  body?: string
  cookie?: string
}

export class FetchJsonRecordReader<R extends rdb.Object> extends RecordReader<R> {

  static fetch = globalThis.fetch

  baseUrlPath: rdb.Maybe<string> = undefined
  body: rdb.Maybe<string> = undefined
  cookie: rdb.Maybe<string> = undefined

  constructor (options : RecordReaderOptions<R> & FetchJsonRecordReaderOptions<R> ) {
    super(options)
    this.baseUrlPath = options.baseUrlPath
    this.body = options.body
    this.cookie = options.cookie
  }

  override async fetch (): Promise<rdb.Anything> {
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
