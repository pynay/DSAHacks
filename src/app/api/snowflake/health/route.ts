import { NextResponse } from 'next/server';
import { snowflakeConfigured, sfQuery } from '@/lib/snowflake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/snowflake/health — verifies the connection and lists the tables that
// schema.sql created. Use this to confirm credentials + setup before wiring the
// rest of the integration.
export async function GET() {
  if (!snowflakeConfigured) {
    return NextResponse.json({
      configured: false,
      message: 'Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, and SNOWFLAKE_PASSWORD (or key-pair) in .env.local.',
    });
  }
  try {
    const [conn] = await sfQuery<{ VERSION: string; WAREHOUSE: string; DATABASE: string; SCHEMA: string }>(
      'SELECT CURRENT_VERSION() AS VERSION, CURRENT_WAREHOUSE() AS WAREHOUSE, CURRENT_DATABASE() AS DATABASE, CURRENT_SCHEMA() AS SCHEMA',
    );
    const tables = await sfQuery<{ TABLE_NAME: string }>(
      'SELECT table_name AS TABLE_NAME FROM information_schema.tables WHERE table_schema = CURRENT_SCHEMA() ORDER BY 1',
    );
    return NextResponse.json({
      configured: true,
      ok: true,
      connection: conn,
      tables: tables.map((t) => t.TABLE_NAME),
    });
  } catch (err) {
    console.error('[/api/snowflake/health] failed:', err);
    return NextResponse.json({ configured: true, ok: false, error: String(err) }, { status: 500 });
  }
}
