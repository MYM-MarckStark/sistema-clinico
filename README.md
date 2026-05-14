# Sistema Clínico

Sistema de gestión para clínica médica. Stack: Node.js + Express + SQL Server, todo dockerizado.

## Requisitos

- [Docker](https://www.docker.com/get-started) y Docker Compose instalados

## Levantar el proyecto

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd <nombre-del-repo>
```

### 2. Configurar variables de entorno (opcional)

```bash
cp .env.example .env
# Edita .env si quieres cambiar la contraseña de la BD
```

### 3. Levantar con Docker Compose

```bash
docker-compose up --build
```

La primera vez tardará unos minutos mientras:
- Descarga la imagen de SQL Server
- Inicializa la base de datos con tablas y datos de prueba
- Construye e inicia el backend

### 4. Acceder a la app

Abre tu navegador en: **http://localhost:3000**

### Usuarios de prueba

| Usuario  | Contraseña | Rol           |
|----------|------------|---------------|
| admin    | 1234       | Administrador |
| doctor1  | 1234       | Doctor        |
| recep1   | 1234       | Recepcionista |

## Detener el proyecto

```bash
docker-compose down
```

Para eliminar también los datos de la base de datos:

```bash
docker-compose down -v
```

## Estructura del proyecto

```
├── backend/          # Servidor Node.js + Express
│   ├── public/       # Frontend (HTML, CSS, JS)
│   ├── server.js     # Rutas y lógica principal
│   ├── db.js         # Configuración de conexión a BD
│   └── Dockerfile
├── init-db/
│   └── clinica.sql   # Schema y datos iniciales
├── docker-compose.yml
├── .env.example      # Plantilla de variables de entorno
└── .gitignore
```

## Despliegue en producción

Ver la sección de despliegue en la wiki del proyecto o consultar las opciones:
- **Railway** — soporta Docker Compose directamente
- **Render** — deploy desde GitHub con Dockerfile
- **VPS (DigitalOcean, Linode)** — clonar repo y correr `docker-compose up -d`
