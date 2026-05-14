const express = require('express');
const session = require('express-session');
const path = require('path');
const { sql, config } = require('./db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'clinica-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// ── AUTH ──────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('u', sql.VarChar, username)
            .input('p', sql.VarChar, password)
            .query(`
                SELECT u.id_usuario, u.username, u.id_rol AS rol, d.id_doctor
                FROM Usuario u
                LEFT JOIN Doctor d ON u.id_usuario = d.id_usuario
                WHERE u.username=@u AND u.password=@p AND u.estado=1
            `);
        if (result.recordset.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });
        req.session.user = result.recordset[0];
        res.json(result.recordset[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    res.json(req.session.user);
});

// ── PACIENTES ─────────────────────────────────────────
app.get('/api/pacientes', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request().query(`SELECT * FROM Paciente ORDER BY apellido`);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pacientes/buscar', async (req, res) => {
    const { q } = req.query;
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .input('q', sql.VarChar, `%${q}%`)
            .query(`
                SELECT * FROM Paciente 
                WHERE nombre LIKE @q 
                   OR apellido LIKE @q 
                   OR CONCAT(nombre, ' ', apellido) LIKE @q
                   OR CONCAT(apellido, ' ', nombre) LIKE @q
                   OR telefono LIKE @q 
                   OR email LIKE @q 
                ORDER BY apellido, nombre
            `);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pacientes/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`SELECT * FROM Paciente WHERE id_paciente=@id`);
        res.json(r.recordset[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pacientes', async (req, res) => {
    const { nombre, apellido, fecha_nacimiento, telefono, email, direccion } = req.body;
    try {
        const pool = await sql.connect(config);
        // Validar duplicado por email o teléfono si existen
        if (email) {
            const dup = await pool.request().input('email', sql.VarChar, email)
                .query(`SELECT id_paciente FROM Paciente WHERE email=@email`);
            if (dup.recordset.length > 0) return res.status(409).json({ error: 'Ya existe un paciente con ese email' });
        }
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('apellido', sql.VarChar, apellido)
            .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
            .input('telefono', sql.VarChar, telefono)
            .input('email', sql.VarChar, email || null)
            .input('direccion', sql.VarChar, direccion || null)
            .query(`INSERT INTO Paciente(nombre,apellido,fecha_nacimiento,telefono,email,direccion) VALUES(@nombre,@apellido,@fecha_nacimiento,@telefono,@email,@direccion)`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DOCTORES ──────────────────────────────────────────
app.get('/api/doctores', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .query(`SELECT d.id_doctor, u.username, d.especialidad, d.precio_consulta FROM Doctor d JOIN Usuario u ON d.id_usuario=u.id_usuario`);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CITAS ─────────────────────────────────────────────
app.get('/api/citas', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request().query(`
            SELECT c.*, p.nombre+' '+p.apellido AS paciente, u.username AS doctor
            FROM Cita c
            JOIN Paciente p ON c.id_paciente=p.id_paciente
            JOIN Doctor d ON c.id_doctor=d.id_doctor
            JOIN Usuario u ON d.id_usuario=u.id_usuario
            ORDER BY c.fecha DESC, c.hora DESC`);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/citas/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`SELECT * FROM Cita WHERE id_cita=@id`);
        res.json(r.recordset[0] || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/citas', async (req, res) => {
    const { id_paciente, id_doctor, fecha, hora, motivo } = req.body;
    try {
        const pool = await sql.connect(config);
        // Validar disponibilidad
        const disp = await pool.request()
            .input('id_doctor', sql.Int, id_doctor)
            .input('fecha', sql.Date, fecha)
            .input('hora', sql.VarChar, hora)
            .query(`SELECT id_cita FROM Cita WHERE id_doctor=@id_doctor AND fecha=@fecha AND hora=@hora AND estado<>'Cancelada'`);
        if (disp.recordset.length > 0) return res.status(409).json({ error: 'El doctor ya tiene una cita en ese horario' });
        await pool.request()
            .input('id_paciente', sql.Int, id_paciente)
            .input('id_doctor', sql.Int, id_doctor)
            .input('fecha', sql.Date, fecha)
            .input('hora', sql.VarChar, hora)
            .input('motivo', sql.VarChar, motivo)
            .query(`INSERT INTO Cita(id_paciente,id_doctor,fecha,hora,motivo,estado) VALUES(@id_paciente,@id_doctor,@fecha,@hora,@motivo,'Programada')`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/cancelar', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`UPDATE Cita SET estado='Cancelada' WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id', async (req, res) => {
    const { id_paciente, id_doctor, fecha, hora, motivo } = req.body;
    try {
        const pool = await sql.connect(config);
        // Validar disponibilidad (excepto la cita actual)
        const disp = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('id_doctor', sql.Int, id_doctor)
            .input('fecha', sql.Date, fecha)
            .input('hora', sql.VarChar, hora)
            .query(`SELECT id_cita FROM Cita WHERE id_doctor=@id_doctor AND fecha=@fecha AND hora=@hora AND estado<>'Cancelada' AND id_cita<>@id`);
        if (disp.recordset.length > 0) return res.status(409).json({ error: 'El doctor ya tiene una cita en ese horario' });
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('id_paciente', sql.Int, id_paciente)
            .input('id_doctor', sql.Int, id_doctor)
            .input('fecha', sql.Date, fecha)
            .input('hora', sql.VarChar, hora)
            .input('motivo', sql.VarChar, motivo)
            .query(`UPDATE Cita SET id_paciente=@id_paciente, id_doctor=@id_doctor, fecha=@fecha, hora=@hora, motivo=@motivo WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/completar', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`UPDATE Cita SET estado='Completada' WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/revision', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`UPDATE Cita SET estado='En revisión' WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/revision', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`UPDATE Cita SET estado='En revisión' WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/reprogramar', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`UPDATE Cita SET estado='Programada' WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DIAGNÓSTICOS / HISTORIAL ──────────────────────────
app.get('/api/historial/:id_paciente', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .input('id', sql.Int, req.params.id_paciente)
            .query(`
                SELECT d.*, u.username AS doctor, doc.especialidad
                FROM Diagnostico d
                JOIN Expediente e ON d.id_expediente = e.id_expediente
                JOIN Doctor doc ON d.id_doctor=doc.id_doctor
                JOIN Usuario u ON doc.id_usuario=u.id_usuario
                WHERE e.id_paciente=@id ORDER BY d.fecha DESC`);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/diagnostico', async (req, res) => {
    const { id_paciente, id_doctor, id_cita, motivo, exploracion, diagnostico, tratamiento, fecha } = req.body;
    try {
        const pool = await sql.connect(config);
        
        // Buscar o crear expediente para el paciente
        let expediente = await pool.request()
            .input('id_paciente', sql.Int, id_paciente)
            .query(`SELECT id_expediente FROM Expediente WHERE id_paciente=@id_paciente`);
        
        let id_expediente;
        if (expediente.recordset.length === 0) {
            // Crear nuevo expediente
            const nuevoExp = await pool.request()
                .input('id_paciente', sql.Int, id_paciente)
                .input('fecha_apertura', sql.DateTime, new Date())
                .query(`INSERT INTO Expediente(id_paciente, fecha_apertura) OUTPUT INSERTED.id_expediente VALUES(@id_paciente, @fecha_apertura)`);
            id_expediente = nuevoExp.recordset[0].id_expediente;
        } else {
            id_expediente = expediente.recordset[0].id_expediente;
        }
        
        // Crear descripción completa
        const descripcionCompleta = [
            `MOTIVO: ${motivo}`,
            exploracion ? `EXPLORACIÓN: ${exploracion}` : '',
            `DIAGNÓSTICO: ${diagnostico}`,
            tratamiento ? `TRATAMIENTO: ${tratamiento}` : '',
            id_cita ? `CITA: ${id_cita}` : ''
        ].filter(Boolean).join('\n');
        
        await pool.request()
            .input('id_expediente', sql.Int, id_expediente)
            .input('id_doctor', sql.Int, id_doctor)
            .input('descripcion', sql.VarChar(sql.MAX), descripcionCompleta)
            .input('fecha', sql.DateTime, new Date(fecha))
            .query(`INSERT INTO Diagnostico(id_expediente,id_doctor,descripcion,fecha) VALUES(@id_expediente,@id_doctor,@descripcion,@fecha)`);
        
        if (id_cita) {
            await pool.request().input('id', sql.Int, id_cita)
                .query(`UPDATE Cita SET estado='Completada' WHERE id_cita=@id`);
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TICKETS / FACTURAS ────────────────────────────────
app.get('/api/tickets/:id', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    f.id_factura, f.monto, f.metodo_pago, f.fecha,
                    p.nombre + ' ' + p.apellido AS paciente,
                    p.telefono, p.email,
                    c.motivo, c.fecha AS fecha_cita, c.hora,
                    d.especialidad,
                    u.username AS doctor
                FROM Factura f
                JOIN Cita c ON f.id_cita = c.id_cita
                JOIN Paciente p ON c.id_paciente = p.id_paciente
                JOIN Doctor doc ON c.id_doctor = doc.id_doctor
                JOIN Usuario u ON doc.id_usuario = u.id_usuario
                JOIN Doctor d ON c.id_doctor = d.id_doctor
                WHERE f.id_factura = @id
            `);
        res.json(r.recordset[0] || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request().query(`
            SELECT f.*, p.nombre+' '+p.apellido AS paciente, c.fecha AS fecha_cita, c.motivo AS servicio
            FROM Factura f
            JOIN Cita c ON f.id_cita=c.id_cita
            JOIN Paciente p ON c.id_paciente=p.id_paciente
            ORDER BY f.fecha DESC`);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/citas/:id/info-ticket', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    c.id_cita, c.motivo,
                    p.nombre + ' ' + p.apellido AS paciente,
                    d.especialidad,
                    doc.precio_consulta AS monto
                FROM Cita c
                JOIN Paciente p ON c.id_paciente = p.id_paciente
                JOIN Doctor doc ON c.id_doctor = doc.id_doctor
                JOIN Doctor d ON c.id_doctor = d.id_doctor
                WHERE c.id_cita = @id
            `);
        res.json(r.recordset[0] || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets', async (req, res) => {
    const { id_cita, monto, metodo_pago } = req.body;
    try {
        const pool = await sql.connect(config);
        
        // Verificar si ya existe un ticket para esta cita
        const existe = await pool.request()
            .input('id_cita', sql.Int, id_cita)
            .query(`SELECT id_factura FROM Factura WHERE id_cita = @id_cita`);
        
        if (existe.recordset.length > 0) {
            return res.status(409).json({ error: 'Ya existe un ticket para esta cita' });
        }
        
        await pool.request()
            .input('id_cita', sql.Int, id_cita)
            .input('monto', sql.Decimal, monto)
            .input('metodo_pago', sql.VarChar, metodo_pago)
            .input('fecha', sql.Date, new Date())
            .query(`INSERT INTO Factura(id_cita,monto,metodo_pago,fecha) VALUES(@id_cita,@monto,@metodo_pago,@fecha)`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── INASISTENCIAS ─────────────────────────────────────
app.put('/api/citas/:id/inasistencia', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`UPDATE Cita SET estado='No asistió' WHERE id_cita=@id`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── REPORTES ──────────────────────────────────────────
app.get('/api/reportes', async (req, res) => {
    const { tipo, desde, hasta, periodo } = req.query;
    try {
        const pool = await sql.connect(config);
        let query = '';
        
        // Calcular fechas según período
        let fechaDesde = desde;
        let fechaHasta = hasta;
        
        if (periodo) {
            const hoy = new Date();
            if (periodo === 'dia') {
                fechaDesde = fechaHasta = hoy.toISOString().split('T')[0];
            } else if (periodo === 'semana') {
                const inicioSemana = new Date(hoy);
                inicioSemana.setDate(hoy.getDate() - hoy.getDay());
                fechaDesde = inicioSemana.toISOString().split('T')[0];
                fechaHasta = hoy.toISOString().split('T')[0];
            } else if (periodo === 'mes') {
                fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
                fechaHasta = hoy.toISOString().split('T')[0];
            }
        }
        
        if (tipo === 'resumen') {
            query = `
                SELECT 
                    (SELECT COUNT(*) FROM Cita WHERE fecha BETWEEN @desde AND @hasta) AS total_citas,
                    (SELECT COUNT(*) FROM Cita WHERE fecha BETWEEN @desde AND @hasta AND estado='Completada') AS completadas,
                    (SELECT COUNT(*) FROM Cita WHERE fecha BETWEEN @desde AND @hasta AND estado='No asistió') AS faltas,
                    (SELECT ISNULL(SUM(f.monto), 0) FROM Factura f JOIN Cita c ON f.id_cita=c.id_cita WHERE c.fecha BETWEEN @desde AND @hasta) AS monto_total
            `;
        } else if (tipo === 'citas') {
            query = `SELECT estado, COUNT(*) AS total FROM Cita WHERE fecha BETWEEN @desde AND @hasta GROUP BY estado`;
        } else if (tipo === 'inasistencias') {
            query = `SELECT p.nombre+' '+p.apellido AS paciente, COUNT(*) AS inasistencias FROM Cita c JOIN Paciente p ON c.id_paciente=p.id_paciente WHERE c.estado='No asistió' AND c.fecha BETWEEN @desde AND @hasta GROUP BY p.nombre,p.apellido`;
        } else if (tipo === 'ingresos') {
            query = `SELECT CONVERT(varchar,f.fecha,23) AS fecha, SUM(f.monto) AS total FROM Factura f WHERE f.fecha BETWEEN @desde AND @hasta GROUP BY CONVERT(varchar,f.fecha,23) ORDER BY fecha`;
        }
        
        const r = await pool.request()
            .input('desde', sql.Date, fechaDesde)
            .input('hasta', sql.Date, fechaHasta)
            .query(query);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EXPEDIENTES (vista panel) ────────────────────────
app.get('/api/expedientes', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const r = await pool.request().query(`
            SELECT DISTINCT p.id_paciente, p.nombre, p.apellido, p.telefono, p.email, 
                   e.fecha_apertura, COUNT(d.id_diagnostico) as total_diagnosticos
            FROM Paciente p
            JOIN Expediente e ON p.id_paciente = e.id_paciente
            LEFT JOIN Diagnostico d ON e.id_expediente = d.id_expediente
            GROUP BY p.id_paciente, p.nombre, p.apellido, p.telefono, p.email, e.fecha_apertura
            ORDER BY e.fecha_apertura DESC
        `);
        res.json(r.recordset);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/consultorios', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const hoy = new Date().toISOString().split('T')[0];
        // Traer todos los doctores con su cita activa de hoy (si existe)
        const r = await pool.request()
            .input('hoy', sql.Date, hoy)
            .query(`
                SELECT 
                    d.id_doctor,
                    u.username AS doctor,
                    d.especialidad,
                    c.id_cita,
                    c.hora,
                    c.estado,
                    c.motivo,
                    p.nombre + ' ' + p.apellido AS paciente
                FROM Doctor d
                JOIN Usuario u ON d.id_usuario = u.id_usuario
                LEFT JOIN Cita c ON c.id_doctor = d.id_doctor 
                    AND c.fecha = @hoy 
                    AND c.estado NOT IN ('Cancelada')
                LEFT JOIN Paciente p ON c.id_paciente = p.id_paciente
                ORDER BY d.id_doctor, c.hora
            `);
        // Agrupar por doctor, quedarnos con la cita más próxima
        const map = {};
        r.recordset.forEach(row => {
            if (!map[row.id_doctor]) {
                map[row.id_doctor] = { ...row };
            }
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/stats', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const hoy = new Date().toISOString().split('T')[0];
        const [citas, pacientes, completadas, inasistencias] = await Promise.all([
            pool.request().input('hoy', sql.Date, hoy).query(`SELECT COUNT(*) AS total FROM Cita WHERE fecha=@hoy`),
            pool.request().query(`SELECT COUNT(*) AS total FROM Paciente`),
            pool.request().input('hoy', sql.Date, hoy).query(`SELECT COUNT(*) AS total FROM Cita WHERE fecha=@hoy AND estado='Completada'`),
            pool.request().input('hoy', sql.Date, hoy).query(`SELECT COUNT(*) AS total FROM Cita WHERE fecha=@hoy AND estado='No asistió'`),
        ]);
        res.json({
            citas_hoy: citas.recordset[0].total,
            total_pacientes: pacientes.recordset[0].total,
            completadas_hoy: completadas.recordset[0].total,
            inasistencias_hoy: inasistencias.recordset[0].total,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));
