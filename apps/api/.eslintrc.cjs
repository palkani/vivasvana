module.exports = {
  root: true,
  extends: ['../../packages/config/eslint-config.cjs'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
};
