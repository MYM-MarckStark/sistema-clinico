const { sql, config } = require('./db');

async function addPrecio() {
  try {
    const pool = await sql.connect(config);
    
    // Agregar columna si no existe
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Doctor') AND name = 'precio_consulta')
      BEGIN
          ALTER TABLE Doctor ADD precio_consulta DECIMAL(10,2) DEFAULT 500.00;
      END
    `);
    
    // Actualizar precios
    await pool.request().query(`
      UPDATE Doctor SET precio_consulta = 500.00 WHERE especialidad = 'Medicina General';
      UPDATE Doctor SET precio_consulta = 800.00 WHERE especialidad LIKE '%Cardiolog%';
      UPDATE Doctor SET precio_consulta = 750.00 WHERE especialidad LIKE '%Pediatr%';
    `);
    
    // Verificar
    const result = await pool.request().query('SELECT id_doctor, especialidad, precio_consulta FROM Doctor');
    console.log('Precios configurados:');
    console.table(result.recordset);
    
    sql.close();
  } catch (e) {
    console.error('Error:', e.message);
    sql.close();
  }
}

addPrecio();
