import rdb from 'rdb'

export interface RecordReaderState<R extends rdb.Object> {
  processing: boolean
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
  mapper: rdb.Maybe<() => R> = undefined

  constructor ({
    resourcePath,
    mapper,
  }: {
    resourcePath?: string,
    mapper?: () => R,
  }) {
    this.resourcePath = resourcePath
    this.mapper = mapper
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
      header: rdb.property(value, 'header', rdb.optional(rdb.record(value => value))),
      payload: rdb.property(value, 'payload', rdb.optional(rdb.record(value => value))),
      failReason: rdb.property(value, 'failReason', rdb.optional(rdb.string)),
    })))

    if (envelope.error) {
      this.finalizeReadOnError(envelope.error, 'rdb.fetch_invalid')
      return
    }

    if (!this.mapper) {
      const error = new rdb.helpers.ErrorWithContext('rdb: missing mapper')
      error.context = [ this ]
      this.finalizeReadOnError(error, 'rdb.missing_mapper')
      return
    }

    const record = rdb.helpers.tryMap(envelope.value, this.mapper)
    if (record.error) {
      this.finalizeReadOnError(record.error, 'rdb.mapping_failed')
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

  finalizeReadOnError (error: rdb.Anything, reason: string) {
    rdb.helpers.logError(error)
    const newState: RecordReaderState<R> = {
      processing: false,
      failReason: reason,
    }
    if (error instanceof Error) {
      newState.error = error
    } else {
      newState.error = new Error('rdb: unsuported type of error')
    }
    this._setState(newState)
  }

}
