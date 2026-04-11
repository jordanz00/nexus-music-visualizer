/**
 * ============================================================================
 * TEST SUITE: NX-TEST-URL-bootstrap-query
 * ============================================================================
 * MODULE UNDER TEST: js/nexus-bootstrap-query.js
 * TEST TYPE: Unit
 * FRAMEWORK: Vitest
 * PRODUCT: NEXUS Engine Pro
 * LAST MODIFIED: 2026-04-10
 * ============================================================================
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOT = path.join(__dirname, '..', 'js', 'nexus-bootstrap-query.js');

function loadBootstrapQuery() {
  const window = { NX: {} };
  const sandbox = { window, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(BOOT, 'utf8'), sandbox);
  return window.NX.BootstrapQuery;
}

describe('NX.BootstrapQuery', () => {
  const BQ = loadBootstrapQuery();

  it('normalizes allowlisted demo keys', () => {
    expect(BQ.normalizeDemo('drop')).toBe('drop');
    expect(BQ.normalizeDemo('Festival')).toBe('festival');
  });

  it('rejects unknown or injected demo values', () => {
    expect(BQ.normalizeDemo('../../../etc/passwd')).toBe('');
    expect(BQ.normalizeDemo('evil')).toBe('');
    expect(BQ.normalizeDemo('')).toBe('');
  });
});
