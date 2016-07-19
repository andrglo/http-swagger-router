/* eslint no-undef:0 */

const assert = require('assert');
const chai = require('chai');
const co = require('@ayk/co');
const expect = chai.expect;
chai.should();
const parser = require('swagger-parser');

const Router = require('../src');
const schema = require('./schemas/person.json');

const isGenerator = gen => gen.next && gen.throw;

const effect = (o) => Promise.resolve(o);
const pubRoute = function *(ctx, {allCaughtUp}) {
  ctx.body = {executed: yield co.effect(effect, allCaughtUp)};
};

const router = new Router();
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
});

addSomeCrudRoutes(router, 'person');

router.get('/public', pubRoute).security([]); // => none
router.get('/private', function*() {
  this.body = {executed: true};
});
router.get('/error400', function*() {
  assert(false, 'assertion');
}).onError({
  name: 'AssertionError',
  schema: 'other'
});
router.get('/error410', function*() {
  assert(false, 'assertion');
}).onError([{
  name: 'AssertionError',
  schema: {
    properties: {
      name: {
        type: 'string'
      }
    }
  },
  status: 410,
  show: (e, ctx) => ({message: 'message is ' + e.message + (ctx.state ? '' : '-error')})
}, {
  name: 'AssertionError',
  schema: {
    properties: {
      name: {
        type: 'string'
      }
    }
  },
  status: 400,
  show: (e) => ({message: 'message is ' + e.message})
}]);

describe('effects', function() {
  it('Check a route', function() {
    const gen = pubRoute({}, {allCaughtUp: false});
    let value = gen.next();
    expect(value.value).to.eql(co.effect(effect, false));
    value = gen.next(false);
    assert(value.value === undefined);
    assert(value.done === true);
  });
});

describe('spec', function() {
  it('build a route to the spec', function() {
    const service = router.findService('get', '/spec');
    assert(Object.keys(service.params).length === 0);
    assert(isGenerator(service.service()));
  });
  it('should have a valid swagger structure in getter', function(done) {
    const spec = router.spec.get();
    parser.validate(spec, {
      $refs: {
        internal: false   // Don't dereference internal $refs, only external
      }
    }, function(err) {
      if (err) {
        console.log('Swagger getter specification:\n', JSON.stringify(spec));
        console.log('Error:\n', err);
      } else {
        assert(spec.definitions.AssertionError !== undefined);
        try {
          expect(spec.paths['/modules/{p1}/{p2}'].get.responses['200']).to.eql({
            description: 'A list of available modules',
            schema: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          });
        } catch (e) {
          err = e;
        }
      }
      done(err);
    });
  });
  it('get service and param', function() {
    const service = router.findService('get', '/person/8');
    expect(service.params).to.eql({name: '8'});
    assert(isGenerator(service.service()));
  });
  it('get service and params', function() {
    const service = router.findService('get', '/modules/q/b');
    expect(service.params).to.eql({p1: 'q', p2: 'b'});
    assert(isGenerator(service.service()));
  });
  it('Should return a 400 error', function(done) {
    const service = router.findService('get', '/error400');
    const state = {};
    co(service.service({}, state))
      .then(() => {
        expect(state.status).to.equal(400);
        expect(state.error).to.eql({message: 'assertion'});
        done();
      })
      .catch(e => {
        done(e);
      });
  });
  it('Should return a 410 error', function(done) {
    const service = router.findService('get', '/error410');
    const state = {};
    co(service.service({}, state))
      .then(() => {
        expect(state.status).to.equal(410);
        expect(state.error).to.eql({message: 'message is assertion-error'});
        done();
      })
      .catch(e => {
        done(e);
      });
  });
  it('mount a route', function() {
    const router2 = new Router();
    router2.get('/public', pubRoute);
    router.mount('/test/', router2);
    let service = router.findService('get', '/test/public');
    assert(Object.keys(service.params).length === 0);
    assert(isGenerator(service.service()));
    service = router.findService('get', '/test/spec');
    assert(Object.keys(service.params).length === 0);
    assert(isGenerator(service.service()));
  });
});

function addSomeCrudRoutes(router, name, entity) {
  const primaryKey = 'name';
  router.spec.addDefinition(name, schema);
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
  });
  let show = error => ({
    name: 'DatabaseError',
    message: error.message,
    details: []
  });

  let queryColumns = [];
  Object.keys(schema.properties).forEach(key => {
    let column = schema.properties[key];
    if (column.type !== 'object' && column.type !== 'array') {
      queryColumns.push({
        name: key,
        description: column.description,
        type: column.type
      });
    }
  });

  router
    .get(`/modules/:p1/:p2`, function *() {
      return ['none'];
    })
    .params([{
      in: 'path',
      name: 'p1'
    }, {
      in: 'path',
      name: 'p2'
    }])
    .onSuccess({
      description: 'A list of available modules',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    });

  router
    .get(`/${name}`, function *({criteria, query}) {
      if (criteria) {
        criteria = JSON.parse(criteria);
        criteria.where = criteria.where || {};
      } else {
        criteria = {
          where: {}
        };
      }
      queryColumns.forEach(column => {
        let value = query[column.name];
        if (value) {
          criteria.where[column.name] = value;
        }
      });
      return yield co.effect('fetch', criteria);
    })
    .description('Get a list of available modules')
    .summary('Summary')
    .description(`Get ${name} list`)
    .params([{
      name: 'criteria',
      description: 'Filter, order and or pagination to apply'
    }].concat(queryColumns))
    .onSuccess({
      items: name
    })
    .onError({
      name: 'DatabaseError',
      catch: ['EntityError', 'RequestError'],
      show
    });

  router
    .get(`/${name}/:${primaryKey}`, function *() {
      let recordset = yield co.effect('recordset');
      if (recordset.length) {
        return recordset[0];
      }
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
    });

  router
    .post(`/${name}`, function *({body}) {
      return yield co.effect('create', body);
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
    });

  router
    .put(`/${name}/:${primaryKey}`, function *({body, params}) {
      const id = params[primaryKey];
      return yield co.effect('update', body, id);
    })
    .params([{
      in: 'path',
      name: primaryKey,
      description: 'Object id'
    }, {
      in: 'body',
      name: 'updatedAt',
      description: `${primaryKey} to be updated`,
      required: true,
      schema: name
    }])
    .onSuccess({
      items: name
    })
    .onError({
      schema: 'EntityError'
    });

  router
    .delete(`/${name}/:${primaryKey}`, function *({body, params}) {
      const id = params[primaryKey];
      return yield co.effect('delete', id);
    })
    .params([{
      in: 'path',
      name: primaryKey,
      description: 'Object id',
      required: true,
      type: 'integer'
    }, {
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
    }])
    .onSuccess({
      status: 204
    })
    .onError({
      schema: 'EntityError'
    });
}


