'use strict'

const debug = require('debug')('koa-observable-redis-session')
const assert = require('assert')
const uid = require('uid-safe')
const redis = require('redis')

module.exports = function (app, options) {
  assert(options, 'options required.')
  assert(options.client || options.uri, '.client or .uri required.')

  const client = options.client || redis.createClient(options.uri)
  const length = options.length || 10
  const prefix = options.prefix || 'hash:koa-session:'

  options.maxAge = options.maxAge || 1000 * 60 * 60 * 24 * 30
  if (typeof options.maxAge === 'string') options.maxAge === require('ms')(options.maxAge)

  options.overwrite = true
  options.signed = true

  app.context.session = function* () {
    if (this._session) return this._session
    return yield* Session.generate(this)
  }

  function Session(ctx) {
    this._ctx = ctx
  }

  Session.generate = function* (ctx) {
    const session = ctx._session = new Session(ctx)
    yield* session._initialize()
    session._observe()
    return session
  }

  Session.prototype.touch = function () {
    return this._update()
  }

  Session.prototype.destroy = function () {
    client.del(this._key, this._ctx.onerror)
    this._ctx.cookies.set('sid')
  }

  Session.prototype.regenerate = function* () {
    this.destroy()
    return yield* Session.generate(this._ctx)
  }

  Session.prototype._initialize = function* () {
    let id = this.id = this._ctx.cookies.get('sid', options)
    debug('id: ' + id)
    let key = this._key = prefix + id
    if (id) {
      let obj = yield new Promise(function (resolve, reject) {
        client.hgetall(key, function (err, obj) {
          if (err) return reject(err)
          resolve(obj)
        })
      })
      if (obj) {
        for (let key of Object.keys(obj)) this[key] = JSON.parse(obj[key])
        return
      }
    }

    yield* this._create()
  }

  Session.prototype._create = function* () {
    this.id = yield uid(length)
    this._key = prefix + this.id
    this._update({
      maxAge: this.maxAge = options.maxAge,
    })
  }

  Session.prototype._update = function (sets, removals) {
    let ms = this.maxAge || options.maxAge

    let ctx = this._ctx
    let key = this._key
    let multi = client.multi()

    if (removals && removals.length) {
      debug('remove: %o', removals)
      multi.hdel([this._key].concat(removals))
    }
    if (sets && Object.keys(sets).length) {
      let args = [key, 'maxAge', ms]
      for (let key of Object.keys(sets)) args.push(key, sets[key])
      debug('set: %o', args)
      multi.hmset(args)
    }
    multi.pexpire(key, ms)
    multi.exec(this._ctx.onerror)
    ctx.cookies.set('sid', this.id, options)
  }

  Session.prototype._observe = function () {
    let session = this

    // whether data is going to be flushed to redis
    let pending = false
    // keys about to be removed
    let removals = []
    // keys about to be set
    let sets = []

    Object.observe(this, function (changes) {
      debug('changes: %o', changes)
      changes.forEach(onchange)

      if (pending) return

      pending = true
      setImmediate(function () {
        session._update(sets, removals)
        pending = false
        removals = []
        sets = {}
      })
    }, [
      'add',
      'update',
      'delete',
    ])

    function onchange(change) {
      let name = change.name
      switch (change.type) {
        case 'add':
        case 'update': {
          let value = JSON.stringify(change.object[name])
          if (value === undefined) {
            // removal the value instead of setting it `undefined`
            remove(name)
            break
          }

          sets[name] = value

          // if the value is pending removal,
          // don't remove it anymore
          let i = removals.indexOf(name)
          if (~i) removals.split(i, 1)
          break
        }
        case 'delete':
          remove(name)
          break
      }
    }

    function remove(name) {
      if (!~removals.indexOf(name)) removals.push(name)
      // if the name is pending a set, don't set it
      delete sets[name]
    }
  }
}
