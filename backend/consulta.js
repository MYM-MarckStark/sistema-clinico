const { sql, config } = require('./db');

async function ejecutarConsulta() {
    try {
        console.log('Intentando conectar...');

        let pool = await sql.connect(config);

        console.log('Conectado a SQL Server');

        let resultado = await pool.request().query(`
            SELECT 
                p.id_paciente,
                p.nombre AS nombre_paciente,
                p.apellido,
                p.telefono,
                p.email,

                c.id_cita,
                c.fecha,
                c.hora,
                c.estado AS estado_cita,
                c.motivo,

                d.id_doctor,
                d.especialidad,

                u.username AS doctor_usuario,

                f.id_factura,
                f.monto,
                f.metodo_pago,
                f.fecha AS fecha_factura

            FROM Paciente p
            LEFT JOIN Cita c 
                ON p.id_paciente = c.id_paciente

            LEFT JOIN Doctor d 
                ON c.id_doctor = d.id_doctor

            LEFT JOIN Usuario u 
                ON d.id_usuario = u.id_usuario

            LEFT JOIN Factura f 
                ON c.id_cita = f.id_cita

            ORDER BY p.id_paciente, c.fecha;
        `);

        console.log('Consulta ejecutada');

        if (resultado.recordset.length === 0) {
            console.log('No hay datos en el sistema');
        } else {
            console.log('Datos obtenidos:');
            console.table(resultado.recordset);
        }

    } catch (error) {
        console.error('Error completo:', error);
    } finally {
        await sql.close();
        console.log('Conexión cerrada');
    }
}

ejecutarConsulta();