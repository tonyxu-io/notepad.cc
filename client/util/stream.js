const proto = {
  subscribe(cb, emitOnSubscribe = true) {
    if (emitOnSubscribe && this.value !== undefined) {
      cb(this.value)
    }
    this.listeners.push(cb)
  },
  addDependent(dependent) {
    this.dependents.push(dependent)
  },
  update(val) {
    this.value = val
    this.changed = true
    this.dependents.forEach(dep => dep.update(val))
  },
  flush() {
    if (this.changed) {
      this.changed = false
      this.listeners.forEach(l => l(this.value))
      this.dependents.forEach(dep => dep.flush())
    }
  },
  unique() {
    let lastValue = this.value
    let unique$ = Stream(lastValue)
    this.subscribe(val => {
      if (val !== lastValue) {
        unique$(val)
        lastValue = val
      }
    })
    return unique$
  },
  map(f) {
    return Stream.combine(this, f)
  },
  filter(f) {
    return this.map(output => (f(output) ? output : undefined))
  },
  debounce(delay) {
    const debounced$ = Stream()
    let timer

    this.unique().subscribe(val => {
      clearTimeout(timer)
      timer = setTimeout(function() {
        debounced$(val)
      }, delay)
    })

    return debounced$
  },
  until(condition$) {
    let pending = !condition$()
    const until$ = Stream(pending ? undefined : this.value)

    condition$.subscribe(isOk => {
      if (isOk && pending) {
        pending = false
        until$(this.value)
      }
    })

    this.subscribe(val => {
      if (!condition$()) {
        pending = true
      } else {
        until$(val)
      }
    })

    return until$
  },
}

function Stream(init) {
  let stream$ = function(val) {
    if (val === undefined) return stream$.value
    stream$.update(val)
    stream$.flush(val)
  }

  stream$.value = init
  stream$.changed = false
  stream$.listeners = []
  stream$.dependents = []

  return Object.assign(stream$, proto)
}

Stream.combine = function(...streams) {
  const combiner = streams.pop()
  let cached = streams.map(stream$ => stream$())
  const combined$ = Stream(combiner(...cached))

  streams.forEach((s, i) => {
    const dependent = {
      update(val) {
        cached[i] = val
        combined$.update(combiner(...cached))
      },
      flush() {
        combined$.flush()
      },
    }
    s.addDependent(dependent)
  })

  return combined$
}

Stream.interval = function(int) {
  let interval$ = Stream()
  setInterval(() => interval$(null), int)
  return interval$
}

Stream.fromEvent = function(elem, type) {
  let event$ = Stream()
  elem.addEventListener(type, event$)
  return event$
}

module.exports = Stream
