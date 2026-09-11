require('dotenv').config();
const { getDb } = require('./src/db/db');

async function runMigration() {
    console.log('Starting PostgreSQL Database Migration...');
    try {
        const pool = await getDb();
        console.log('PostgreSQL migration & seeding completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
