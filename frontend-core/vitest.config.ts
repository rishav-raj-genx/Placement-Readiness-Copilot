const path = require('node:path') as typeof import('node:path');

module.exports = {
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], include: ['tests/**/*.test.ts'] },
};
