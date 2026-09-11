const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

let pool = null;

function getPoolConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
    }
    return {
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432', 10),
        database: process.env.PG_DATABASE || 'idukkiroots',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'postgres',
        ssl: false
    };
}

async function ensureDatabaseExists() {
    if (process.env.DATABASE_URL) return; // Hosted PostgreSQL creates database via URL

    const dbName = process.env.PG_DATABASE || 'idukkiroots';
    const client = new Client({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432', 10),
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'postgres',
        database: 'postgres' // Connect to default postgres DB first
    });

    try {
        await client.connect();
        const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (res.rowCount === 0) {
            console.log(`Database "${dbName}" does not exist. Creating database...`);
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database "${dbName}" created successfully.`);
        }
    } catch (err) {
        console.warn('Could not auto-create database (might already exist or lack permission):', err.message);
    } finally {
        await client.end().catch(() => {});
    }
}

async function getDb() {
    if (pool) return pool;

    await ensureDatabaseExists();

    pool = new Pool(getPoolConfig());

    pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
    });

    try {
        const client = await pool.connect();
        console.log('Connected to PostgreSQL database successfully.');
        client.release();

        await initializeDb();
        return pool;
    } catch (error) {
        console.error('PostgreSQL connection failed:', error.message);
        throw error;
    }
}

// Seed rows are inserted with explicit ids, which leaves SERIAL sequences behind (the next insert collides with id 1).
// Move any lagging sequence past its table's current max id; safe to run on every startup.
async function syncIdSequences() {
    const serialCols = await pool.query(`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'
    `);

    for (const { table_name, column_name } of serialCols.rows) {
        const seqRes = await pool.query('SELECT pg_get_serial_sequence($1, $2) AS seq', [table_name, column_name]);
        const seq = seqRes.rows[0].seq;
        if (!seq) continue;

        const maxRes = await pool.query(`SELECT COALESCE(MAX("${column_name}"), 0)::bigint AS max_id FROM "${table_name}"`);
        const seqState = await pool.query(`SELECT last_value, is_called FROM ${seq}`);
        const maxId = Number(maxRes.rows[0].max_id);
        const { last_value, is_called } = seqState.rows[0];
        const nextValue = is_called ? Number(last_value) + 1 : Number(last_value);

        if (maxId >= nextValue) {
            await pool.query('SELECT setval($1, $2)', [seq, maxId]); // next nextval() returns maxId + 1
            console.log(`Advanced ${seq} to ${maxId}`);
        }
    }
}

async function initializeDb() {
    try {
        const schemaPath = path.join(__dirname, '../../database/schema_pg.sql');
        const seedPath = path.join(__dirname, '../../database/seed_pg.sql');

        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schemaSql);
            console.log('PostgreSQL schema applied successfully.');
        }

        // Check if users table is empty to seed initial data
        const userCheck = await pool.query('SELECT COUNT(*)::int as count FROM users');
        if (userCheck.rows[0].count === 0) {
            console.log('Database is empty. Applying PostgreSQL seed data...');
            if (fs.existsSync(seedPath)) {
                const seedSql = fs.readFileSync(seedPath, 'utf8');
                await pool.query(seedSql);
                console.log('Seed data applied successfully.');
            }
        }

        await syncIdSequences();

        // Sync Admin credentials strictly from .env
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (adminEmail && adminPassword) {
            const adminRes = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
            const adminUser = adminRes.rows[0];

            if (!adminUser) {
                const hash = await bcrypt.hash(adminPassword, 10);
                await pool.query(
                    `INSERT INTO users (email, password_hash, first_name, last_name, role) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [adminEmail, hash, 'Admin', 'Manager', 'admin']
                );
                console.log(`Admin user ${adminEmail} created from .env credentials.`);
            } else {
                const match = await bcrypt.compare(adminPassword, adminUser.password_hash || '');
                if (!match) {
                    const hash = await bcrypt.hash(adminPassword, 10);
                    await pool.query(
                        'UPDATE users SET password_hash = $1, role = $2 WHERE email = $3',
                        [hash, 'admin', adminEmail]
                    );
                    console.log(`Admin user ${adminEmail} password updated from .env credentials.`);
                }
            }
        }
    } catch (error) {
        console.error('PostgreSQL database initialization failed:', error);
    }
}

module.exports = {
    getDb,
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect()
};
