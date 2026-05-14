-- Agregar columna de precio a Doctor (si no existe)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Doctor') AND name = 'precio_consulta')
BEGIN
    ALTER TABLE Doctor ADD precio_consulta DECIMAL(10,2) DEFAULT 500.00;
END
GO

-- Actualizar precios por especialidad
UPDATE Doctor SET precio_consulta = 500.00 WHERE especialidad = 'Medicina General';
UPDATE Doctor SET precio_consulta = 800.00 WHERE especialidad LIKE '%Cardiolog%';
UPDATE Doctor SET precio_consulta = 750.00 WHERE especialidad LIKE '%Pediatra%';
UPDATE Doctor SET precio_consulta = 700.00 WHERE especialidad LIKE '%Dermatologo%';
UPDATE Doctor SET precio_consulta = 650.00 WHERE especialidad LIKE '%Ginecologo%';
GO
-- Verificar
SELECT id_doctor, especialidad, precio_consulta FROM Doctor;
GO