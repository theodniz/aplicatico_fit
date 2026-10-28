// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // `import styled from 'styled-components/native'` é a forma
    // documentada da biblioteca; a regra acusa falso positivo.
    rules: { "import/no-named-as-default": "off" },
  }
]);
