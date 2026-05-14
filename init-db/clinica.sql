-- ============================================================
-- SCHEMA CLINICA - PostgreSQL
-- ============================================================

-- Tabla: Rol
CREATE TABLE IF NOT EXISTS rol (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

-- Tabla: Usuario
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    estado BOOLEAN NOT NULL DEFAULT true,
    id_rol INT NOT NULL,
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
);

-- Tabla: Doctor
CREATE TABLE IF NOT EXISTS doctor (
    id_doctor SERIAL PRIMARY KEY,
    id_usuario INT UNIQUE,
    especialidad VARCHAR(100),
    precio_consulta DECIMAL(10,2) DEFAULT 500,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- Tabla: Paciente
CREATE TABLE IF NOT EXISTS paciente (
    id_paciente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    direccion VARCHAR(255),
    fecha_registro TIMESTAMP DEFAULT NOW()
);

-- Tabla: Expediente
CREATE TABLE IF NOT EXISTS expediente (
    id_expediente SERIAL PRIMARY KEY,
    id_paciente INT UNIQUE,
    fecha_apertura TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente)
);

-- Tabla: Cita
CREATE TABLE IF NOT EXISTS cita (
    id_cita SERIAL PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_doctor INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    estado VARCHAR(20) NOT NULL,
    motivo VARCHAR(255),
    FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
    FOREIGN KEY (id_doctor) REFERENCES doctor(id_doctor)
);

-- Tabla: Factura
CREATE TABLE IF NOT EXISTS factura (
    id_factura SERIAL PRIMARY KEY,
    id_cita INT UNIQUE,
    monto DECIMAL(10,2) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    metodo_pago VARCHAR(50),
    FOREIGN KEY (id_cita) REFERENCES cita(id_cita)
);

-- Tabla: Diagnostico
CREATE TABLE IF NOT EXISTS diagnostico (
    id_diagnostico SERIAL PRIMARY KEY,
    id_expediente INT NOT NULL,
    id_doctor INT NOT NULL,
    descripcion TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (id_expediente) REFERENCES expediente(id_expediente),
    FOREIGN KEY (id_doctor) REFERENCES doctor(id_doctor)
);

-- Tabla: Horario
CREATE TABLE IF NOT EXISTS horario (
    id_horario SERIAL PRIMARY KEY,
    id_doctor INT NOT NULL,
    dia_semana VARCHAR(20) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    FOREIGN KEY (id_doctor) REFERENCES doctor(id_doctor)
);

-- Tabla: Inasistencia
CREATE TABLE IF NOT EXISTS inasistencia (
    id_inasistencia SERIAL PRIMARY KEY,
    id_cita INT UNIQUE,
    motivo VARCHAR(255),
    fecha_registro TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (id_cita) REFERENCES cita(id_cita)
);

-- Tabla: Recepcionista
CREATE TABLE IF NOT EXISTS recepcionista (
    id_recepcionista SERIAL PRIMARY KEY,
    id_usuario INT UNIQUE,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- Tabla: Reporte
CREATE TABLE IF NOT EXISTS reporte (
    id_reporte SERIAL PRIMARY KEY,
    tipo_reporte VARCHAR(50),
    fecha_generacion TIMESTAMP DEFAULT NOW(),
    descripcion TEXT
);

-- ============================================================
-- DATOS INICIALES
-- ============================================================

INSERT INTO rol (nombre_rol) VALUES ('Admin'), ('Doctor'), ('Recepcionista')
ON CONFLICT DO NOTHING;

INSERT INTO usuario (username, password, estado, id_rol) VALUES
('admin',   '1234', true, 1),
('doctor1', '1234', true, 2),
('recep1',  '1234', true, 3)
ON CONFLICT DO NOTHING;

INSERT INTO doctor (id_usuario, especialidad, precio_consulta)
VALUES (2, 'Medicina General', 500)
ON CONFLICT DO NOTHING;

INSERT INTO paciente (nombre, apellido, telefono, email, direccion) VALUES
('Carlos',   'Perez',         '5512345678', 'Carlos@mail.com',        'Ecatepec'),
('Marco',    'Tellez',        '5587654321', 'Marco@mail.com',         'Ecatepec'),
('Emiliano', 'Toledo de Ary', '5570713434', 'ToledoQlero@gmail.com',  'Ecatepec')
ON CONFLICT DO NOTHING;

INSERT INTO expediente (id_paciente) VALUES (1), (2), (3)
ON CONFLICT DO NOTHING;

INSERT INTO cita (id_paciente, id_doctor, fecha, hora, estado, motivo) VALUES
(1, 1, '2026-04-27', '10:00', 'Completada', 'Consulta general'),
(3, 1, '2026-04-28', '12:00', 'Completada', 'Consulta Particular'),
(3, 1, '2026-04-27', '17:00', 'Completada', 'Sintomas de Sida y Mongolismo')
ON CONFLICT DO NOTHING;

INSERT INTO factura (id_cita, monto, metodo_pago) VALUES
(1, 500,  'Efectivo'),
(2, 600,  'Tarjeta'),
(3, 1500, 'Transferencia')
ON CONFLICT DO NOTHING;

INSERT INTO diagnostico (id_expediente, id_doctor, descripcion) VALUES
(3, 1, 'Diagnóstico general'),
(1, 1, 'Prueba Test')
ON CONFLICT DO NOTHING;

INSERT INTO recepcionista (id_usuario) VALUES (3)
ON CONFLICT DO NOTHING;
