import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Running notification preferences migration...');

  try {
    // Read and execute the migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_notification_preferences.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the raw SQL
    await prisma.$executeRawUnsafe(sql);

    console.log('✅ Notification preferences migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
