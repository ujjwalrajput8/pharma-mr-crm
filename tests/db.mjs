// Throwaway Postgres (PGlite, in memory) on 127.0.0.1:54329. Empty on start —
// the real deploy script (server/scripts/db-deploy.cjs) applies migrations + seed.
// Everything is lost when this process stops.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: 54329, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log('TEST DB READY on 127.0.0.1:54329');
