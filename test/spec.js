/* eslint no-undef:0 */

const assert = require('assert')
const chai = require('chai')
const expect = chai.expect
chai.should()
const parser = require('swagger-parser')

const Router = require('../src')
const schema = require('./schemas/person.json')

const isPromise = gen => gen.then

const effect = o => Promise.resolve(o)
const pubRoute = async (ctx, {allCaughtUp}) => {
  ctx.body = {executed: await effect(allCaughtUp)}
}

const router = new Router()
router.spec.addDefinition('other', {
  myProperty: 'invalid swagger',
  properties: {
    name: {
      type: 'array',
      items: {
        type: 'string',
        description: 'none'
      }
    },
    otherProperty: {
      type: 'object',
      format: 'none',
      properties: {
        name: {
          type: 'string'
        }
      }
    }
  }
})

addSomeCrudRoutes(router, 'person')

router.get('/public', pubRoute).security([]) // => none
router.get('/private', async () => {
  return {executed: true}
})
router
    .get('/error400', async () => {
      assert(false, 'assertion')
    })
    .onError({
      name: 'AssertionError',
      schema: 'other'
    })
router
    .get('/error410', async () => {
      assert(false, 'assertion')
    })
    .onError([
      {
        name: 'AssertionError',
        schema: {
          properties: {
            name: {
              type: 'string'
            }
          }
        },
        status: 410,
        show: (e, ctx) => ({
          message: 'message is ' + e.message + (ctx.state ? '' : '-error')
        })
      },
      {
        name: 'AssertionError',
        schema: {
          properties: {
            name: {
              type: 'string'
            }
          }
        },
        status: 400,
        show: e => ({message: 'message is ' + e.message})
      }
    ])

describe('spec', function() {
  it('build a route to the spec', function() {
    const service = router.findService('get', '/spec')
    assert(Object.keys(service.params).length === 0)
    assert(isPromise(service.service()))
  })
  it('should have a valid swagger structure in getter', function(done) {
    const spec = router.spec.get()
    parser.validate(JSON.parse(JSON.stringify(spec)), function(err) {
      if (err) {
        console.log('Swagger getter specification:\n', JSON.stringify(spec))
        console.log('Error:\n', err)
      } else {
        assert(spec.definitions.AssertionError !== undefined)
        try {
          expect(spec.paths['/modules/{p1}/{p2}'].get.responses['200']).to.eql({
            description: 'A list of available modules',
            schema: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          })
        } catch (e) {
          err = e
        }
      }
      done(err)
    })
  })
  it('get service and param', function() {
    const service = router.findService('get', '/person/8')
    expect(service.params).to.eql({name: '8'})
    assert(isPromise(service.service()))
  })
  it('get service and params', function() {
    const service = router.findService('get', '/modules/q/b')
    expect(service.params).to.eql({p1: 'q', p2: 'b'})
    assert(isPromise(service.service()))
  })
  it('get service and query', function() {
    const service = router.findService('get', '/query?a=1&b=2')
    expect(service.query).to.eql({a: '1', b: '2'})
    assert(isPromise(service.service()))
  })
  it('get service and params and query', function() {
    const service = router.findService('get', '/modules/q/b/?a=1')
    expect(service.params).to.eql({p1: 'q', p2: 'b'})
    expect(service.query).to.eql({a: '1'})
    assert(isPromise(service.service()))
  })
  it('Should return a 400 error', function(done) {
    const service = router.findService('get', '/error400')
    const state = {}
    service
        .service({}, state)
        .then(() => {
          expect(state.status).to.equal(400)
          expect(state.error).to.eql({message: 'assertion'})
          done()
        })
        .catch(e => {
          done(e)
        })
  })
  it('Should return a 410 error', function(done) {
    const service = router.findService('get', '/error410')
    const state = {}
    service
        .service({}, state)
        .then(() => {
          expect(state.status).to.equal(410)
          expect(state.error).to.eql({message: 'message is assertion-error'})
          done()
        })
        .catch(e => {
          done(e)
        })
  })
  it('get a definition', function(done) {
    const service = router.findService('get', '/spec?definition=DatabaseError')
    const ctx = {}
    const state = {}
    ctx.params = service.params
    ctx.query = service.query
    service
        .service(ctx, state)
        .then(schema => {
          expect(state.status).to.equal(200)
          expect(schema.properties.name.type).equal('string')
          done()
        })
        .catch(e => {
          done(e)
        })
  })
  it('mount a route', function() {
    const router2 = new Router()
    router2.get('/public', pubRoute)
    router.mount('/test/', router2)
    let service = router.findService('get', '/test/public')
    assert(Object.keys(service.params).length === 0)
    assert(isPromise(service.service()))
    service = router.findService('get', '/test/spec')
    assert(Object.keys(service.params).length === 0)
    assert(isPromise(service.service()))
  })
})

function addSomeCrudRoutes(router, name, entity) {
  const primaryKey = 'name'
  router.spec.addDefinition(name, schema)
  router.spec.addDefinition('DatabaseError', {
    properties: {
      name: {
        type: 'string'
      },
      message: {
        type: 'string'
      },
      details: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  })
  const show = error => ({
    name: 'DatabaseError',
    message: error.message,
    details: []
  })

  const queryColumns = []
  Object.keys(schema.properties).forEach(key => {
    const column = schema.properties[key]
    if (column.type !== 'object' && column.type !== 'array') {
      queryColumns.push({
        name: key,
        description: column.description,
        type: column.type
      })
    }
  })

  router.spec.addDefinition('EntityError', {
    type: 'object',
    title: 'Entity',
    description: 'None',
    properties: {
      method: {
        type: 'string'
      }
    }
  })

  router
      .get(`/modules/:p1/:p2`, async () => {
        return ['none']
      })
      .params([
        {
          in: 'path',
          name: 'p1'
        },
        {
          in: 'path',
          name: 'p2'
        }
      ])
      .onSuccess({
        description: 'A list of available modules',
        schema: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      })

  router
      .get(`/query`, async () => {
        return ['none']
      })
      .onSuccess({
        description: 'A query',
        schema: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      })

  router
      .get(`/${name}`, async ({criteria, query}) => {
        if (criteria) {
          criteria = JSON.parse(criteria)
          criteria.where = criteria.where || {}
        } else {
          criteria = {
            where: {}
          }
        }
        queryColumns.forEach(column => {
          const value = query[column.name]
          if (value) {
            criteria.where[column.name] = value
          }
        })
        return criteria
      })
      .description('Get a list of available modules')
      .summary('Summary')
      .description(`Get ${name} list`)
      .params(
          [
            {
              name: 'criteria',
              description: 'Filter, order and or pagination to apply'
            }
          ].concat(queryColumns)
      )
      .onSuccess({
        items: name
      })
      .onError({
        name: 'DatabaseError',
        catch: ['EntityError', 'RequestError'],
        show
      })

  router
      .get(`/${name}/:${primaryKey}`, async () => {
        return recordset[0]
      })
      .params({
        in: 'path',
        name: primaryKey,
        description: `${name} to be find`
      })
      .onSuccess({
        items: name
      })
      .onError({
        schema: 'EntityError'
      })

  router
      .post(`/${name}`, async ({body}) => {
        return body
      })
      .params({
        in: 'body',
        name: 'body',
        description: `${name} to be added`,
        required: true,
        schema: name
      })
      .onSuccess({
        name,
        status: 201
      })
      .onError({
        schema: 'EntityError'
      })

  router
      .put(`/${name}/:${primaryKey}`, async ({body, params}) => {
        return body
      })
      .params([
        {
          in: 'path',
          name: primaryKey,
          description: 'Object id'
        },
        {
          in: 'body',
          name: 'updatedAt',
          description: `${primaryKey} to be updated`,
          required: true,
          schema: name
        }
      ])
      .onSuccess({
        items: name
      })
      .onError({
        schema: 'EntityError'
      })

  router
      .delete(`/${name}/:${primaryKey}`, async ({body, params}) => {})
      .params([
        {
          in: 'path',
          name: primaryKey,
          description: 'Object id',
          required: true,
          type: 'integer'
        },
        {
          in: 'body',
          name: 'updatedAt',
          description: 'Last update timestamp',
          required: true,
          schema: {
            type: 'object',
            properties: {
              updatedAt: {
                type: 'string',
                format: 'date-time'
              }
            }
          }
        }
      ])
      .onSuccess({
        status: 204
      })
      .onError({
        schema: 'EntityError'
      })
}
