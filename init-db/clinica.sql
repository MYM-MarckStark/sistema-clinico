------------------------------------------------------------
-- CREAR BASE DE DATOS (solo si no existe)
------------------------------------------------------------
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'Clinica')
BEGIN
    CREATE DATABASE Clinica;
END
GO
USE Clinica;
GO

------------------------------------------------------------
-- TABLAS
------------------------------------------------------------

-- Tabla: Rol
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Rol')
BEGIN
    CREATE TABLE Rol (
        id_rol INT IDENTITY(1,1) PRIMARY KEY,
        nombre_rol VARCHAR(50) NOT NULL UNIQUE
    );
END
GO

-- Tabla: Usuario
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuario')
BEGIN
    CREATE TABLE Usuario (
        id_usuario INT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        estado BIT NOT NULL,
        id_rol INT NOT NULL,
        FOREIGN KEY (id_rol) REFERENCES Rol(id_rol)
    );
END
GO

-- Tabla: Doctor
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Doctor')
BEGIN
    CREATE TABLE Doctor (
        id_doctor INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT UNIQUE,
        especialidad VARCHAR(100),
        precio_consulta DECIMAL(10,2) DEFAULT 500,
        FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
    );
END
GO

-- Tabla: Paciente
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Paciente')
BEGIN
    CREATE TABLE Paciente (
        id_paciente INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        fecha_nacimiento DATE,
        telefono VARCHAR(20),
        email VARCHAR(100) UNIQUE,
        direccion VARCHAR(255),
        fecha_registro DATETIME DEFAULT GETDATE()
    );
END
GO

-- Tabla: Expediente
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Expediente')
BEGIN
    CREATE TABLE Expediente (
        id_expediente INT IDENTITY(1,1) PRIMARY KEY,
        id_paciente INT UNIQUE,
        fecha_apertura DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (id_paciente) REFERENCES Paciente(id_paciente)
    );
END
GO

-- Tabla: Cita
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cita')
BEGIN
    CREATE TABLE Cita (
        id_cita INT IDENTITY(1,1) PRIMARY KEY,
        id_paciente INT NOT NULL,
        id_doctor INT NOT NULL,
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        estado VARCHAR(20) NOT NULL,
        motivo VARCHAR(255),
        FOREIGN KEY (id_paciente) REFERENCES Paciente(id_paciente),
        FOREIGN KEY (id_doctor) REFERENCES Doctor(id_doctor)
    );
END
GO

-- Tabla: Factura
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Factura')
BEGIN
    CREATE TABLE Factura (
        id_factura INT IDENTITY(1,1) PRIMARY KEY,
        id_cita INT UNIQUE,
        monto DECIMAL(10,2) NOT NULL,
        fecha DATETIME DEFAULT GETDATE(),
        metodo_pago VARCHAR(50),
        FOREIGN KEY (id_cita) REFERENCES Cita(id_cita)
    );
END
GO

-- Tabla: Diagnostico
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Diagnostico')
BEGIN
    CREATE TABLE Diagnostico (
        id_diagnostico INT IDENTITY(1,1) PRIMARY KEY,
        id_expediente INT NOT NULL,
        id_doctor INT NOT NULL,
        descripcion TEXT NOT NULL,
        fecha DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (id_expediente) REFERENCES Expediente(id_expediente),
        FOREIGN KEY (id_doctor) REFERENCES Doctor(id_doctor)
    );
END
GO

-- Tabla: Horario
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Horario')
BEGIN
    CREATE TABLE Horario (
        id_horario INT IDENTITY(1,1) PRIMARY KEY,
        id_doctor INT NOT NULL,
        dia_semana VARCHAR(20) NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL,
        FOREIGN KEY (id_doctor) REFERENCES Doctor(id_doctor)
    );
END
GO

-- Tabla: Inasistencia
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Inasistencia')
BEGIN
    CREATE TABLE Inasistencia (
        id_inasistencia INT IDENTITY(1,1) PRIMARY KEY,
        id_cita INT UNIQUE,
        motivo VARCHAR(255),
        fecha_registro DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (id_cita) REFERENCES Cita(id_cita)
    );
END
GO

-- Tabla: Recepcionista
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Recepcionista')
BEGIN
    CREATE TABLE Recepcionista (
        id_recepcionista INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT UNIQUE,
        FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
    );
END
GO

-- Tabla: Reporte
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Reporte')
BEGIN
    CREATE TABLE Reporte (
        id_reporte INT IDENTITY(1,1) PRIMARY KEY,
        tipo_reporte VARCHAR(50),
        fecha_generacion DATETIME DEFAULT GETDATE(),
        descripcion TEXT
    );
END
GO

------------------------------------------------------------
-- INSERTS INICIALES (solo si las tablas están vacías)
------------------------------------------------------------

-- Roles
IF NOT EXISTS (SELECT 1 FROM Rol)
BEGIN
    INSERT INTO Rol (nombre_rol) VALUES ('Admin'), ('Doctor'), ('Recepcionista');
END
GO

-- Usuarios
IF NOT EXISTS (SELECT 1 FROM Usuario)
BEGIN
    INSERT INTO Usuario (username, password, estado, id_rol) VALUES
    ('admin', '1234', 1, 1),
    ('doctor1', '1234', 1, 2),
    ('recep1', '1234', 1, 3);
END
GO

-- Doctor
IF NOT EXISTS (SELECT 1 FROM Doctor)
BEGIN
    INSERT INTO Doctor (id_usuario, especialidad, precio_consulta)
    VALUES (2, 'Medicina General', 500);
END
GO

-- Pacientes
IF NOT EXISTS (SELECT 1 FROM Paciente)
BEGIN
    INSERT INTO Paciente (nombre, apellido, telefono, email, direccion) VALUES
    ('Carlos', 'Perez', '5512345678', 'Carlos@mail.com', 'Ecatepec'),
    ('Marco', 'Tellez', '5587654321', 'Marco@mail.com', 'Ecatepec'),
    ('Emiliano', 'Toledo de Ary', '5570713434', 'ToledoQlero@gmail.com', 'Ecatepec');
END
GO

-- Expedientes
IF NOT EXISTS (SELECT 1 FROM Expediente)
BEGIN
    INSERT INTO Expediente (id_paciente) VALUES (1), (2), (3);
END
GO

-- Citas
IF NOT EXISTS (SELECT 1 FROM Cita)
BEGIN
    INSERT INTO Cita (id_paciente, id_doctor, fecha, hora, estado, motivo) VALUES
    (1, 1, '2026-04-27', '10:00', 'Completada', 'Consulta general'),
    (3, 1, '2026-04-28', '12:00', 'Completada', 'Consulta Particular'),
    (3, 1, '2026-04-27', '17:00', 'Completada', 'Sintomas de Sida y Mongolismo');
END
GO

-- Facturas
IF NOT EXISTS (SELECT 1 FROM Factura)
BEGIN
    INSERT INTO Factura (id_cita, monto, metodo_pago) VALUES
    (1, 500, 'Efectivo'),
    (2, 600, 'Tarjeta'),
    (3, 1500, 'Transferencia');
END
GO

-- Diagnósticos
IF NOT EXISTS (SELECT 1 FROM Diagnostico)
BEGIN
    INSERT INTO Diagnostico (id_expediente, id_doctor, descripcion) VALUES
    (3, 1, 'Diagnóstico general'),
    (1, 1, 'Prueba Test');
END
GO

-- Recepcionista
IF NOT EXISTS (SELECT 1 FROM Recepcionista)
BEGIN
    INSERT INTO Recepcionista (id_usuario) VALUES (3);
END
GO
