const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const { getDb, loadDatabaseEnv } = require('../shared/db_env');

async function main() {
  loadDatabaseEnv();

  const [username, password, nameArg] = process.argv.slice(2);
  if (!username || !password) {
    throw new Error('Usage: npm run user:create-admin -- <username> <password> [display_name]');
  }

  const displayName = nameArg || username;
  const passwordHash = await bcrypt.hash(password, 10);
  const db = getDb();

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').get(username);

    if (existing) {
      db.prepare(
        'UPDATE users SET password_hash = ?, name = ?, role = ? WHERE username = ?'
      ).run(passwordHash, displayName, 'admin', username);
      console.log(`Updated existing user ${username} as admin.`);
      return;
    }

    db.prepare(
      'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)'
    ).run(username, passwordHash, displayName, 'admin');
    console.log(`Created admin user ${username}.`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
