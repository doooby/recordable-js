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

  constructor ({
    resourcePath,
    headerMapper,
    payloadMapper,
  }: {
    resourcePath?: string
    headerMapper?: () => R
    payloadMapper?: () => R
  }) {
    this.resourcePath = resourcePath
    this.headerMapper = headerMapper
    this.payloadMapper = payloadMapper
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

export class FetchJsonRecordReader<R extends rdb.Object> extends RecordReader<R> {

}
