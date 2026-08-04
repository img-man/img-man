// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('AccessToken schema indexes', () => {
  it('does not duplicate the token index at schema level', () => {
    const filePath = resolve(process.cwd(), 'src/models/access-token.ts');
    const content = readFileSync(filePath, 'utf-8');

    expect(content).toContain("token: { type: String, required: true, unique: true }");
    expect(content).not.toContain('AccessTokenSchema.index({ token: 1 });');
  });
});
