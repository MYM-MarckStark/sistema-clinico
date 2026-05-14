const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

// ── DB ────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'clinica-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// ── HEALTH ────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected' });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

// ── AUTH ──────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(`
            SELECT u.id_usuario, u.username, u.id_rol AS rol, d.id_doctor
            FROM usuario u
            LEFT JOIN doctor d ON u.id_usuario = d.id_usuario
            WHERE u.username=$1 AND u.password=$2 AND u.estado=true
        `, [username, password]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });
        req.session.user = result.rows[0];
        res.json(result.rows[0]);
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
        const r = await pool.query(`SELECT * FROM paciente ORDER BY apellido`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pacientes/buscar', async (req, res) => {
    const { q } = req.query;
    try {
        const r = await pool.query(`
            SELECT * FROM paciente
            WHERE nombre ILIKE $1 OR apellido ILIKE $1
               OR (nombre || ' ' || apellido) ILIKE $1
               OR telefono ILIKE $1 OR email ILIKE $1
            ORDER BY apellido, nombre
        `, [`%${q}%`]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pacientes/:id', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM paciente WHERE id_paciente=$1`, [req.params.id]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pacientes', async (req, res) => {
    const { nombre, apellido, fecha_nacimiento, telefono, email, direccion } = req.body;
    try {
        if (email) {
            const dup = await pool.query(`SELECT id_paciente FROM paciente WHERE email=$1`, [email]);
            if (dup.rows.length > 0) return res.status(409).json({ error: 'Ya existe un paciente con ese email' });
        }
        await pool.query(
            `INSERT INTO paciente(nombre,apellido,fecha_nacimiento,telefono,email,direccion) VALUES($1,$2,$3,$4,$5,$6)`,
            [nombre, apellido, fecha_nacimiento || null, telefono, email || null, direccion || null]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DOCTORES ──────────────────────────────────────────
app.get('/api/doctores', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT d.id_doctor, u.username, d.especialidad, d.precio_consulta
            FROM doctor d JOIN usuario u ON d.id_usuario=u.id_usuario
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CITAS ─────────────────────────────────────────────
app.get('/api/citas', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT c.*, p.nombre||' '||p.apellido AS paciente, u.username AS doctor
            FROM cita c
            JOIN paciente p ON c.id_paciente=p.id_paciente
            JOIN doctor d ON c.id_doctor=d.id_doctor
            JOIN usuario u ON d.id_usuario=u.id_usuario
            ORDER BY c.fecha DESC, c.hora DESC
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/citas/:id', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM cita WHERE id_cita=$1`, [req.params.id]);
        res.json(r.rows[0] || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/citas', async (req, res) => {
    const { id_paciente, id_doctor, fecha, hora, motivo } = req.body;
    try {
        const disp = await pool.query(
            `SELECT id_cita FROM cita WHERE id_doctor=$1 AND fecha=$2 AND hora=$3 AND estado<>'Cancelada'`,
            [id_doctor, fecha, hora]
        );
        if (disp.rows.length > 0) return res.status(409).json({ error: 'El doctor ya tiene una cita en ese horario' });
        await pool.query(
            `INSERT INTO cita(id_paciente,id_doctor,fecha,hora,motivo,estado) VALUES($1,$2,$3,$4,$5,'Programada')`,
            [id_paciente, id_doctor, fecha, hora, motivo]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/cancelar', async (req, res) => {
    try {
        await pool.query(`UPDATE cita SET estado='Cancelada' WHERE id_cita=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id', async (req, res) => {
    const { id_paciente, id_doctor, fecha, hora, motivo } = req.body;
    try {
        const disp = await pool.query(
            `SELECT id_cita FROM cita WHERE id_doctor=$1 AND fecha=$2 AND hora=$3 AND estado<>'Cancelada' AND id_cita<>$4`,
            [id_doctor, fecha, hora, req.params.id]
        );
        if (disp.rows.length > 0) return res.status(409).json({ error: 'El doctor ya tiene una cita en ese horario' });
        await pool.query(
            `UPDATE cita SET id_paciente=$1, id_doctor=$2, fecha=$3, hora=$4, motivo=$5 WHERE id_cita=$6`,
            [id_paciente, id_doctor, fecha, hora, motivo, req.params.id]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/completar', async (req, res) => {
    try {
        await pool.query(`UPDATE cita SET estado='Completada' WHERE id_cita=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/revision', async (req, res) => {
    try {
        await pool.query(`UPDATE cita SET estado='En revisión' WHERE id_cita=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/reprogramar', async (req, res) => {
    try {
        await pool.query(`UPDATE cita SET estado='Programada' WHERE id_cita=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/citas/:id/inasistencia', async (req, res) => {
    try {
        await pool.query(`UPDATE cita SET estado='No asistió' WHERE id_cita=$1`, [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DIAGNÓSTICOS ──────────────────────────────────────
app.get('/api/historial/:id_paciente', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT d.*, u.username AS doctor, doc.especialidad
            FROM diagnostico d
            JOIN expediente e ON d.id_expediente = e.id_expediente
            JOIN doctor doc ON d.id_doctor=doc.id_doctor
            JOIN usuario u ON doc.id_usuario=u.id_usuario
            WHERE e.id_paciente=$1 ORDER BY d.fecha DESC
        `, [req.params.id_paciente]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/diagnostico', async (req, res) => {
    const { id_paciente, id_doctor, id_cita, motivo, exploracion, diagnostico, tratamiento, fecha } = req.body;
    try {
        let expediente = await pool.query(`SELECT id_expediente FROM expediente WHERE id_paciente=$1`, [id_paciente]);
        let id_expediente;
        if (expediente.rows.length === 0) {
            const r = await pool.query(
                `INSERT INTO expediente(id_paciente, fecha_apertura) VALUES($1, NOW()) RETURNING id_expediente`,
                [id_paciente]
            );
            id_expediente = r.rows[0].id_expediente;
        } else {
            id_expediente = expediente.rows[0].id_expediente;
        }
        const desc = [
            `MOTIVO: ${motivo}`,
            exploracion ? `EXPLORACIÓN: ${exploracion}` : '',
            `DIAGNÓSTICO: ${diagnostico}`,
            tratamiento ? `TRATAMIENTO: ${tratamiento}` : '',
            id_cita ? `CITA: ${id_cita}` : ''
        ].filter(Boolean).join('\n');
        await pool.query(
            `INSERT INTO diagnostico(id_expediente,id_doctor,descripcion,fecha) VALUES($1,$2,$3,$4)`,
            [id_expediente, id_doctor, desc, new Date(fecha)]
        );
        if (id_cita) await pool.query(`UPDATE cita SET estado='Completada' WHERE id_cita=$1`, [id_cita]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TICKETS ───────────────────────────────────────────
app.get('/api/tickets', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT f.*, p.nombre||' '||p.apellido AS paciente, c.fecha AS fecha_cita, c.motivo AS servicio
            FROM factura f
            JOIN cita c ON f.id_cita=c.id_cita
            JOIN paciente p ON c.id_paciente=p.id_paciente
            ORDER BY f.fecha DESC
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT f.id_factura, f.monto, f.metodo_pago, f.fecha,
                p.nombre||' '||p.apellido AS paciente, p.telefono, p.email,
                c.motivo, c.fecha AS fecha_cita, c.hora,
                d.especialidad, u.username AS doctor
            FROM factura f
            JOIN cita c ON f.id_cita=c.id_cita
            JOIN paciente p ON c.id_paciente=p.id_paciente
            JOIN doctor d ON c.id_doctor=d.id_doctor
            JOIN usuario u ON d.id_usuario=u.id_usuario
            WHERE f.id_factura=$1
        `, [req.params.id]);
        res.json(r.rows[0] || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/citas/:id/info-ticket', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT c.id_cita, c.motivo, p.nombre||' '||p.apellido AS paciente,
                d.especialidad, d.precio_consulta AS monto
            FROM cita c
            JOIN paciente p ON c.id_paciente=p.id_paciente
            JOIN doctor d ON c.id_doctor=d.id_doctor
            WHERE c.id_cita=$1
        `, [req.params.id]);
        res.json(r.rows[0] || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets', async (req, res) => {
    const { id_cita, monto, metodo_pago } = req.body;
    try {
        const existe = await pool.query(`SELECT id_factura FROM factura WHERE id_cita=$1`, [id_cita]);
        if (existe.rows.length > 0) return res.status(409).json({ error: 'Ya existe un ticket para esta cita' });
        await pool.query(
            `INSERT INTO factura(id_cita,monto,metodo_pago,fecha) VALUES($1,$2,$3,NOW())`,
            [id_cita, monto, metodo_pago]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── REPORTES ──────────────────────────────────────────
app.get('/api/reportes', async (req, res) => {
    const { tipo, desde, hasta, periodo } = req.query;
    try {
        let fechaDesde = desde, fechaHasta = hasta;
        if (periodo) {
            const hoy = new Date();
            if (periodo === 'dia') { fechaDesde = fechaHasta = hoy.toISOString().split('T')[0]; }
            else if (periodo === 'semana') {
                const ini = new Date(hoy); ini.setDate(hoy.getDate() - hoy.getDay());
                fechaDesde = ini.toISOString().split('T')[0];
                fechaHasta = hoy.toISOString().split('T')[0];
            } else if (periodo === 'mes') {
                fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
                fechaHasta = hoy.toISOString().split('T')[0];
            }
        }
        let query = '';
        if (tipo === 'resumen') {
            query = `SELECT
                (SELECT COUNT(*) FROM cita WHERE fecha BETWEEN $1 AND $2) AS total_citas,
                (SELECT COUNT(*) FROM cita WHERE fecha BETWEEN $1 AND $2 AND estado='Completada') AS completadas,
                (SELECT COUNT(*) FROM cita WHERE fecha BETWEEN $1 AND $2 AND estado='No asistió') AS faltas,
                (SELECT COALESCE(SUM(f.monto),0) FROM factura f JOIN cita c ON f.id_cita=c.id_cita WHERE c.fecha BETWEEN $1 AND $2) AS monto_total`;
        } else if (tipo === 'citas') {
            query = `SELECT estado, COUNT(*) AS total FROM cita WHERE fecha BETWEEN $1 AND $2 GROUP BY estado`;
        } else if (tipo === 'inasistencias') {
            query = `SELECT p.nombre||' '||p.apellido AS paciente, COUNT(*) AS inasistencias FROM cita c JOIN paciente p ON c.id_paciente=p.id_paciente WHERE c.estado='No asistió' AND c.fecha BETWEEN $1 AND $2 GROUP BY p.nombre,p.apellido`;
        } else if (tipo === 'ingresos') {
            query = `SELECT TO_CHAR(f.fecha,'YYYY-MM-DD') AS fecha, SUM(f.monto) AS total FROM factura f WHERE f.fecha::date BETWEEN $1 AND $2 GROUP BY TO_CHAR(f.fecha,'YYYY-MM-DD') ORDER BY fecha`;
        }
        const r = await pool.query(query, [fechaDesde, fechaHasta]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EXPEDIENTES ───────────────────────────────────────
app.get('/api/expedientes', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT p.id_paciente, p.nombre, p.apellido, p.telefono, p.email,
                   e.fecha_apertura, COUNT(d.id_diagnostico) as total_diagnosticos
            FROM paciente p
            JOIN expediente e ON p.id_paciente=e.id_paciente
            LEFT JOIN diagnostico d ON e.id_expediente=d.id_expediente
            GROUP BY p.id_paciente, p.nombre, p.apellido, p.telefono, p.email, e.fecha_apertura
            ORDER BY e.fecha_apertura DESC
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONSULTORIOS ──────────────────────────────────────
app.get('/api/consultorios', async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const r = await pool.query(`
            SELECT d.id_doctor, u.username AS doctor, d.especialidad,
                c.id_cita, c.hora, c.estado, c.motivo,
                p.nombre||' '||p.apellido AS paciente
            FROM doctor d
            JOIN usuario u ON d.id_usuario=u.id_usuario
            LEFT JOIN cita c ON c.id_doctor=d.id_doctor AND c.fecha=$1 AND c.estado NOT IN ('Cancelada')
            LEFT JOIN paciente p ON c.id_paciente=p.id_paciente
            ORDER BY d.id_doctor, c.hora
        `, [hoy]);
        const map = {};
        r.rows.forEach(row => { if (!map[row.id_doctor]) map[row.id_doctor] = { ...row }; });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ─────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const [citas, pacientes, completadas, inasistencias] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total FROM cita WHERE fecha=$1`, [hoy]),
            pool.query(`SELECT COUNT(*) AS total FROM paciente`),
            pool.query(`SELECT COUNT(*) AS total FROM cita WHERE fecha=$1 AND estado='Completada'`, [hoy]),
            pool.query(`SELECT COUNT(*) AS total FROM cita WHERE fecha=$1 AND estado='No asistió'`, [hoy]),
        ]);
        res.json({
            citas_hoy: parseInt(citas.rows[0].total),
            total_pacientes: parseInt(pacientes.rows[0].total),
            completadas_hoy: parseInt(completadas.rows[0].total),
            inasistencias_hoy: parseInt(inasistencias.rows[0].total),
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── START ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en puerto ${PORT}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'OK' : 'MISSING'}`);
});
