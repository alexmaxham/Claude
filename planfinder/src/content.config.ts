import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { carrierSchema, planSchema } from './lib/schema';

const carriers = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/carriers' }),
  schema: carrierSchema,
});

const plans = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/plans' }),
  schema: planSchema,
});

export const collections = { carriers, plans };
