const { sql, config } = require('./db');

async function checkPaciente() {
  try {
    const pool = await sql.connect(config);
    const r = await pool.request().query(`
      SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Paciente'
      ORDER BY ORDINAL_POSITION
    `);
    console.table(r.recordset);
    sql.close();
  } catch (e) {
    console.error('Error:', e.message);
    sql.close();
  }
}

checkPaciente();
