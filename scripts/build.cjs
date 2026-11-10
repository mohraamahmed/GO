#!/usr/bin/env node
process.env.NODE_ENV = 'production';
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim();
const { spawnSync } = require('child_process');
const path = require('path');

const viteBin = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
const result = spawnSync(
  process.execPath,
  ['--max-old-space-size=4096', viteBin, 'build', '--mode', 'production'],
  { stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 0);
