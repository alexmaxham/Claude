import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { deviceSchema } from './lib/schema';

const devices = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/devices' }),
  schema: deviceSchema,
});

export const collections = { devices };
