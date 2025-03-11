import rdb from '../dist/rdb.v1.1.js'

const globals = {
  async mock (opts, fn) {
    const originals = {}

    if (typeof opts === 'function') {
      fn = opts
      opts = undefined
    } else {
      if (opts.captureLogError) {
        originals.logError = rdb.helpers.logError
        rdb.helpers.logError = function (...args) {
          const state = globals.getState('errorLogs')
          if (!state.calls) state.calls = []
          state.calls.push(args)
        }
      }
    }

    for (const [ name, value ] of Object.entries(globals.properties)) {
      originals[name] = globalThis[name]
      globalThis[name] = value
    }
    try {
      await fn()
    }
    finally {
      globals.state = {}
      for (const name of Object.keys(globals.properties)) {
        globalThis[name] = originals[name]
      }

      if (opts?.captureLogError) {
        rdb.helpers.logError = originals.logError
      }
    }
  },
  getState (property) {
    if (!globals.state[property]) globals.state[property] = {}
    return globals.state[property]
  },
  setState (property, values) {
   const state = globals.getState(property) 
   Object.assign(state, values)
   return state
  },
  state: {},
  properties: { 
    location: {
      origin: 'http://localhost.test',
    },
    async fetch (...args) {
      const state = globals.setState('fetch', {
        args,
      })
      return { 
        ok: state.ok,
        text: state.text,
        json: state.json,
      }
    },
  },
}

export {
  rdb,
  globals,
}

