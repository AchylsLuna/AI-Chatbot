import fs from 'fs/promises';
import path from 'path';

const rateLimitTsconfigPath = path.resolve(
  process.cwd(),
  'node_modules',
  'express-rate-limit',
  'tsconfig.json'
);

const patchedConfig = {
  extends: '@express-rate-limit/tsconfig/tsconfig.json',
  include: ['dist/**/*.d.ts'],
  exclude: ['node_modules'],
  compilerOptions: {
    target: 'ES2020'
  }
};

async function patchTsconfig() {
  try {
    await fs.access(rateLimitTsconfigPath);
  } catch {
    // Dependency not installed yet.
    return;
  }

  const next = `${JSON.stringify(patchedConfig, null, 2)}\n`;
  await fs.writeFile(rateLimitTsconfigPath, next, 'utf8');
}

patchTsconfig().catch((error) => {
  console.warn('Could not patch express-rate-limit tsconfig:', error.message);
});
