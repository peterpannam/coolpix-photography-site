import { createClient } from '@sanity/client';

// Only used at build time. Skipping the CDN means each build gets the latest published content
export const client = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  apiVersion: '2026-11-07',
  useCdn: false,
});
