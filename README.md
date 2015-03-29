
# observable-redis-session

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]
[![Gittip][gittip-image]][gittip-url]

A session module that uses `Object.observe()` to set values to Redis atomically and asynchronously.

Usage:

```js
const app = require('koa')()
require('session')(app, {
  uri: 'tcp://localhost:6379'
})

app.use(function* (next) {
  try {
    yield* next
  } catch (err) {
    throw err
  } finally {
    // always give time for `Object.observe()` to do its thing
    yield setImmediate
  }
})

app.use(function* (next) {
  let session = yield this.session()

  session.userid = '1234'

  yield* next
})
```

## API

### session(app, options)

Adds `this.session()` to the app.

Options:

- `.uri` - Redis URI
- `.client` - Redis client, if not set by `.uri`
- `.length` - session id key byte length, default `10`
- `.prefix` - Redis key prefix, default `hash:koa-session:`
- `.maxAge` - max session age, default `30 days`

### let session = yield this.session()

Grab the session asynchronously.

### session.touch()

Update the session without changing the values on the server.

### session.destroy()

Destroy the session.

### let session = session.regenerate()

Destroy the old session and return a new one.

### session.maxAge=

Set the max age for this session, defaulting to `options.maxAge`.

### Caveats

- You must always `yield setImmediate` upstream to allow `Object.observe()` time to execute its callback.

[npm-image]: https://img.shields.io/npm/v/koa-observable-redis-session.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-observable-redis-session
[github-tag]: http://img.shields.io/github/tag/koajs/observable-redis-session.svg?style=flat-square
[github-url]: https://github.com/koajs/observable-redis-session/tags
[travis-image]: https://img.shields.io/travis/koajs/observable-redis-session.svg?style=flat-square
[travis-url]: https://travis-ci.org/koajs/observable-redis-session
[coveralls-image]: https://img.shields.io/coveralls/koajs/observable-redis-session.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/koajs/observable-redis-session
[david-image]: http://img.shields.io/david/koajs/observable-redis-session.svg?style=flat-square
[david-url]: https://david-dm.org/koajs/observable-redis-session
[license-image]: http://img.shields.io/npm/l/koa-observable-redis-session.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/koa-observable-redis-session.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/koa-observable-redis-session
[gittip-image]: https://img.shields.io/gratipay/jonathanong.svg?style=flat-square
[gittip-url]: https://gratipay.com/jonathanong/
