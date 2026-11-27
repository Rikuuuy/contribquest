// Quality levels for the world renderer (v1.6, pure; requirement 25). The frame-time step-down arrives with
// task 11.8.

export type Quality = 'high' | 'medium' | 'low';

export const QUALITY = {
  high: { ratioCap: 2, shadows: true, shadowMap: 2048, fireflies: 1, particles: 1 },
  medium: { ratioCap: 1.5, shadows: true, shadowMap: 1024, fireflies: 1, particles: 1 },
  low: { ratioCap: 1, shadows: false, shadowMap: 0, fireflies: 0.5, particles: 0.5 },
} as const;
