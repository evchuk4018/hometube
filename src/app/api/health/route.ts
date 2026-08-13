import { pool } from '@/server/db/client';

export async function GET() {
  try {
    await pool.query('SELECT 1');
    return Response.json({ status: 'healthy' });
  } catch {
    return Response.json({ status: 'unhealthy' }, { status: 503 });
  }
}

