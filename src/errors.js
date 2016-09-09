const AssertionError = 'AssertionError';

const assertionSchema = {
  properties: {
    name: {
      type: 'string'
    },
    message: {
      type: 'string'
    }
  }
};

module.exports = {
  schemas: {
    assertionSchema
  },
  assertion: [{
    name: AssertionError,
    schema: assertionSchema,
    catch: [AssertionError],
    show: error => ({
      name: 'AssertionError',
      message: error.message
    })
  }]
};
