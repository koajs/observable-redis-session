'use strict'

const request = require('supertest')
const assert = require('assert')
const redis = require('redis')
const koa = require('koa')

const session = require('..')

const client = redis.createClient()
const options = {
  client: client ,
  prefix: 'session:',
}
let app

before(function (done) {
  client.flushall(done)
})

beforeEach(function () {
  app = koa()
  app.keys = ['asdf']
  session(app, options)
  app.use(function* (next) {
    try {
      yield* next
    } catch (err) {
      throw err
    } finally {
      yield setImmediate
      yield setImmediate
    }
  })
})

describe('new session', function () {
  it('should write a cookie and set the redis hash', function (done) {
    let id

    app.use(function* () {
      let session = yield this.session()
      id = session.id

      session.a = 1
      session.b = 2

      this.status = 204
    })

    request(app.listen())
    .get('/')
    .expect(204)
    .expect('Set-Cookie', /sid/, function (err) {
      if (err) return done(err)

      setTimeout(function () {
        client.hgetall('session:' + id, function (err, obj) {
          if (err) return done(err)

          assert(obj)
          assert(obj.a === '1')
          assert(obj.b === '2')

          done()
        })
      }, 10)
    })
  })

  it('should delete a redis hash', function (done) {
    let id

    app.use(function* () {
      let session = yield this.session()
      id = session.id

      session.a = 1
      session.b = 2

      yield setImmediate
      yield setImmediate

      delete session.a
      delete session.a

      this.status = 204
    })

    request(app.listen())
    .get('/')
    .expect(204)
    .expect('Set-Cookie', /sid/, function (err) {
      if (err) return done(err)

      setTimeout(function () {
        client.hgetall('session:' + id, function (err, obj) {
          if (err) return done(err)

          assert(obj)
          assert(obj.a == null)
          assert(obj.b === '2')

          done()
        })
      }, 10)
    })
  })
})

describe('.touch()', function () {
  it('should set the cookie', function (done) {
    let id

    app.use(function* () {
      let session = yield this.session()

      if (this.method === 'GET') {
        session.a = 1
        session.b = '2'
        session.c = true
      } else {
        assert.equal(session.a, 1)
        assert.equal(session.b, '2')
        assert.equal(session.c, true)
        session.touch()
      }

      this.status = 204
    })

    let server = app.listen()

    request(server)
    .get('/')
    .expect(204)
    .expect('Set-Cookie', /sid/, function (err, res) {
      if (err) return done(err)

      setTimeout(function () {
        request(server)
        .post('/')
        .set('cookie', res.headers['set-cookie'].join(';'))
        .expect(204, done)
      }, 10)
    })
  })
})

describe('.destroy()', function () {
  it('should destroy a session', function (done) {
    let id

    app.use(function* () {
      let session = yield this.session()

      if (this.method === 'GET') {
        id = session.id
        session.a = 1
      } else {
        session.destroy()
      }

      this.status = 204
    })

    let server = app.listen()

    request(server)
    .get('/')
    .expect(204)
    .expect('Set-Cookie', /sid/, function (err, res) {
      if (err) return done(err)

      setTimeout(function () {
        request(server)
        .post('/')
        .set('cookie', res.headers['set-cookie'].join(';'))
        .expect(204, function (err) {
          if (err) return done(err)

          client.hgetall('session:' + id, function (err, obj) {
            if (err) return done(err)

            assert(!obj)
            done()
          })
        })
      }, 10)
    })
  })
})

describe('.regenerate()', function () {
  it('should return a new session', function (done) {
    let id

    app.use(function* () {
      let session = yield this.session()

      let session2 = yield session.regenerate()

      assert(session !== session2)
      assert(session.id !== session2.id)
      assert(session2 === (yield this.session()))

      session2.a = 1

      this.status = 204
    })

    request(app.listen())
    .get('/')
    .expect(204)
    .expect('Set-Cookie', /sid/, done)
  })
})
