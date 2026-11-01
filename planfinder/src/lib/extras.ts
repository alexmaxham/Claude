// Discount programs, price-change log and head-to-head matchups. Checked against their schemas at
// build time, so a typo in a data file fails the build with a clear message.
import { z } from 'astro/zod';
import discountsJson from '../data/discounts.json';
import changesJson from '../data/changes.json';
import versusJson from '../data/versus.json';
import { changeSchema, discountSchema } from './schema';

export const discounts = z.array(discountSchema).parse(discountsJson);
export type Discount = (typeof discounts)[number];
export const changes = z.array(changeSchema).parse(changesJson).sort((a, b) => b.date.localeCompare(a.date));
export const versusPairs = z.array(z.tuple([z.string(), z.string()])).parse(versusJson);

export const GROUP_LABEL: Record<Discount['groups'][number], string> = {
  military: 'Military & veterans',
  'first-responders': 'First responders',
  nurses: 'Nurses',
  teachers: 'Teachers',
  students: 'Students',
  seniors: '55 and older',
  employer: 'Through your employer',
  'low-income': 'Low income',
};
