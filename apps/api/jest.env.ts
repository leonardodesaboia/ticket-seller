process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/test';
