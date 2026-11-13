import { describe, expect, it, vi } from 'vitest';
import { PROJECT_FUNCTION_SOURCE_LIMIT, readProjectFunctionSource } from './saasConsole';

describe('browser-selected Function source', () => {
  it('preserves BOM, Unicode, CRLF, whitespace and legitimate replacement characters', async () => {
    const source = '\uFEFF// 中文 😀 �\r\n\texport default () => new Response(" hello ");\r\n';
    expect(await readProjectFunctionSource(new File([source], 'main.ts'))).toBe(source);
  });

  it('accepts the exact UTF-8 byte limit and refuses oversized files before reading', async () => {
    const source = '界'.repeat(87381) + ';';
    expect(new TextEncoder().encode(source).byteLength).toBe(PROJECT_FUNCTION_SOURCE_LIMIT);
    expect(await readProjectFunctionSource(new File([source], 'main.ts'))).toBe(source);
    for (const size of [0, -1, 0.5, NaN, Infinity, PROJECT_FUNCTION_SOURCE_LIMIT + 1]) {
      const arrayBuffer = vi.fn();
      expect(await readProjectFunctionSource({ size, arrayBuffer })).toBeNull();
      expect(arrayBuffer).not.toHaveBeenCalled();
    }
  });

  it('rejects malformed UTF-8, whitespace-only files and NUL without repairing bytes', async () => {
    for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0xc0, 0xaf]), new Uint8Array([0xe4, 0xb8]), new Uint8Array([0xed, 0xa0, 0x80]), new Uint8Array([0xf4, 0x90, 0x80, 0x80])]) {
      expect(await readProjectFunctionSource(new File([bytes], 'main.ts'))).toBeNull();
    }
    for (const source of ['\r\n\t ', '\uFEFF', 'export default () => new Response();\0']) {
      expect(await readProjectFunctionSource(new File([source], 'main.ts'))).toBeNull();
    }
  });

  it('refuses inconsistent sizes and leaves read failures distinguishable', async () => {
    expect(await readProjectFunctionSource({ size: 1, arrayBuffer: async () => new ArrayBuffer(2) })).toBeNull();
    await expect(readProjectFunctionSource({ size: 1, arrayBuffer: async () => { throw new Error('read failed'); } })).rejects.toThrow('read failed');
  });
});
