const { sql, config } = require('./db');

async function checkTables() {
  try {
    const pool = await sql.connect(config);
    const r = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    console.log('Tablas disponibles:');
    console.table(r.recordset);
    sql.close();
  } catch (e) {
    console.error('Error:', e.message);
    sql.close();
  }
}

checkTables();