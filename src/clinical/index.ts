/**
 * Canonical clinical layer — public surface.
 *
 * Import from '@/clinical' rather than reaching into individual files, so the
 * single-source-of-truth boundary stays visible in review.
 */

export * from './types';
export * from './sources';
export * from './registry';
export * from './safety';
export { utiProtocol } from './protocols/uti';
export { acneProtocol } from './protocols/acne';
export { dermatitisProtocol } from './protocols/dermatitis';
