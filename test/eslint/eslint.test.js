const { ESLint } = require('eslint');
const { restrictedSyntax } = require('@/../scripts/webpack-util');

test('eslint no-restricted-syntax', async () => {
  const linter = new ESLint({
    useEslintrc: false,
    baseConfig: {
      parserOptions: {
        ecmaVersion: 2021
      },
      rules: {
        'no-restricted-syntax': ['error', ...restrictedSyntax]
      }
    }
  });
  
  // Test that the rule catches all restricted patterns
  const code = restrictedSyntax.map(r => r.code + ';').join('');
  const expected = restrictedSyntax.map(r => (delete r.code, r.message));
  for (const path of ['', '/content', '/web']) {
    const filePath = require.resolve(`../../src/injected${path}/index.js`);
    const res = await linter.lintText(code, { filePath });
    const found = res[0].messages;
    const unexpected = found.filter(m => !expected.includes(m.message));
    const missed = expected.filter(msg => !found.some(f => msg === f.message));
    expect(unexpected).toEqual([]);
    expect(missed).toEqual([]);
  }

  // Test that safe code passes
  const safeCode = 'const x = 1; function foo() { return x + 1; }';
  const safeResult = await linter.lintText(safeCode);
  expect(safeResult[0].messages).toEqual([]);

  // Test that a specific restricted pattern is caught
  const unsafeCode = 'Object.assign({}, {foo: 1});';
  const unsafeResult = await linter.lintText(unsafeCode);
  // console.log('Messages for unsafe code:', unsafeResult[0].messages);
  expect(unsafeResult[0].messages.map(m => m.message)).toEqual([
    'Using potentially spoofed methods in an unsafe environment',
    'Using potentially spoofed methods in an unsafe environment'
  ]);
});
