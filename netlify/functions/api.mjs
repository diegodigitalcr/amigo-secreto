import { getDatabase } from '@netlify/database';
import { createApi } from '../../lib/api-core.mjs';

let handler;

export default async (req) => {
  if (!handler) {
    const { pool } = getDatabase();
    handler = createApi({
      query: (text, params) => pool.query(text, params),
      adminKey: process.env.ADMIN_KEY || ''
    });
  }
  return handler(req);
};

export const config = {
  path: '/api/*'
};
