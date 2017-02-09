const AssertionError = 'AssertionError';
const TimeoutError = 'TimeoutError';

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

const errors = {
  schemas: {
    errorSchema
  },
  assertion: [{
    name: AssertionError,
    schema: errorSchema,
    catch: [AssertionError],
    show: error => ({
      name: 'AssertionError',
      message: error.message
    })
  }],
  timeout: [{
    status: 408,
    name: TimeoutError,
    schema: errorSchema,
    catch: [
      error => error.code === 'timeout'
    ],
    show: error => ({
      name: TimeoutError,
      message: 'Tempo de espera esgotado',
    })
  }],
  all: [
    ...errors.assertion,
    ...errors.timeout
  ]
};

module.exports = errors;
