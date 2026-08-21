// Server-only Snowflake access. Env-gated: if the SNOWFLAKE_* vars aren't set,
// `snowflakeConfigured` is false and callers fall back to the local behavior,
// so the app runs fine without credentials. Secrets live only in .env.local
// (gitignored). They are never committed or logged.
import 'server-only';
import snowflake from 'snowflake-sdk';
import fs from 'node:fs';

const {
  SNOWFLAKE_ACCOUNT,
  SNOWFLAKE_USERNAME,
  SNOWFLAKE_PASSWORD,
  SNOWFLAKE_WAREHOUSE,
  SNOWFLAKE_DATABASE = 'PARSEL',
  SNOWFLAKE_SCHEMA = 'CORE',
  SNOWFLAKE_ROLE,
  SNOWFLAKE_PRIVATE_KEY_PATH,
  SNOWFLAKE_PRIVATE_KEY_PASSPHRASE,
} = process.env;

export const snowflakeConfigured = Boolean(
  SNOWFLAKE_ACCOUNT && SNOWFLAKE_USERNAME && (SNOWFLAKE_PASSWORD || SNOWFLAKE_PRIVATE_KEY_PATH),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function connect(): Promise<any> {
  return new Promise((resolve, reject) => {
    snowflake.configure({ logLevel: 'ERROR' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = {
      account: SNOWFLAKE_ACCOUNT,
      username: SNOWFLAKE_USERNAME,
      warehouse: SNOWFLAKE_WAREHOUSE,
      database: SNOWFLAKE_DATABASE,
      schema: SNOWFLAKE_SCHEMA,
      role: SNOWFLAKE_ROLE,
    };
    if (SNOWFLAKE_PRIVATE_KEY_PATH) {
      base.authenticator = 'SNOWFLAKE_JWT';
      base.privateKey = fs.readFileSync(SNOWFLAKE_PRIVATE_KEY_PATH, 'utf8');
      if (SNOWFLAKE_PRIVATE_KEY_PASSPHRASE) base.privateKeyPass = SNOWFLAKE_PRIVATE_KEY_PASSPHRASE;
    } else {
      base.password = SNOWFLAKE_PASSWORD;
    }
    const conn = snowflake.createConnection(base);
    conn.connect((err, c) => (err ? reject(err) : resolve(c)));
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getConn(): Promise<any> {
  if (!snowflakeConfigured) throw new Error('Snowflake not configured. Set SNOWFLAKE_* in .env.local');
  if (!connPromise) {
    connPromise = connect().catch((e) => {
      connPromise = null; // allow retry on next call
      throw e;
    });
  }
  return connPromise;
}

// Run a query, returning row objects (column names are UPPERCASE in Snowflake).
export async function sfQuery<T = Record<string, unknown>>(sqlText: string, binds: unknown[] = []): Promise<T[]> {
  const conn = await getConn();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: binds as (string | number | null)[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      complete: (err: unknown, _stmt: unknown, rows: any[]) => (err ? reject(err) : resolve((rows ?? []) as T[])),
    });
  });
}
