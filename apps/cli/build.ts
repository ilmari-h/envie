import esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(
  readFileSync(join(import.meta.dirname, 'package.json'), 'utf-8')
);

const isWatch = process.argv.includes('--watch');

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/index.js',
  format: 'cjs',
  external: ['sshpk', '@noble/curves'],
  define: {
    __VERSION_STRING__: JSON.stringify(packageJson.version),
  },
};

try {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log(`✓ Watching for changes... (v${packageJson.version})`);
  } else {
    await esbuild.build(buildOptions);
    console.log(`✓ Build successful (v${packageJson.version})`);
  }
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}