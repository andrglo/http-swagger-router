const AssertionError = 'AssertionError';

const errorSchema = {
  properties: {
    name: {
      type: 'string'
    },
    message: {
      type: 'string'
    }
  }
};

const assertion = [{
  name: AssertionError,
  schema: errorSchema,
  catch: [AssertionError],
  show: error => ({
    name: 'AssertionError',
    message: error.message
  })
}];

module.exports = {
  schemas: {
    errorSchema
  },
  assertion,
  all: [
    ...assertion
  ]
};
