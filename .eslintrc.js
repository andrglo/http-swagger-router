module.exports = {
  "extends": "google",
  "parserOptions": {
    "ecmaVersion": 2017,
    "sourceType": "module"
  },
  "rules": {
    "generator-star-spacing": [
      "error", {
        "before": true,
        "after": false
      }],
    "comma-dangle": 0,
    "semi": ["error", "never"],
    "require-jsdoc": 0,
    "no-extra-parens": 2,
    "arrow-parens": ["error", "as-needed"],
    "yield-star-spacing": ["error", {"before": true, "after": false}],
    "max-len": ["error", {
      "ignoreComments": true,
      "ignoreStrings": true,
      "ignoreTemplateLiterals": true
    }],
    "no-var": 0,
    "camelcase": 0,
  }
};
