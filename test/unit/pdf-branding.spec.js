import { describe, it, expect } from 'vitest';
import { getBranding } from '../../src/pdf/branding.js';

describe('PDF branding assets', () => {
  it('exposes the supplied header and footer assets', () => {
    const branding = getBranding();
    expect(branding.assets.header).toEqual(expect.any(Array));
    expect(branding.assets.footer).toEqual(expect.any(Array));
  });
});
