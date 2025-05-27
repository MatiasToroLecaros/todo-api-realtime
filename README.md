# API de Gestión de Tareas en Tiempo Real

Una aplicación completa de lista de tareas (To-Do List) desarrollada con Node.js, Express, SQLite y WebSockets que permite gestionar tareas en tiempo real con sincronización automática entre todos los clientes conectados.

## 🚀 Características

- **API RESTful completa** para gestión de tareas (CRUD)
- **Actualizaciones en tiempo real** usando WebSockets (Socket.IO)
- **Base de datos SQLite** para persistencia de datos
- **Frontend responsivo** con interfaz moderna
- **Validación robusta** de datos y manejo de errores
- **Sincronización automática** entre múltiples clientes

## 📋 Estructura del Proyecto

```
todo-api-realtime/
├── server.js              # Servidor principal con Express y Socket.IO
├── database.js            # Clase para manejo de base de datos SQLite
├── package.json           # Dependencias y scripts del proyecto
├── README.md              # Documentación del proyecto
├── public/
│   ├── index.html         # Frontend HTML
│   └── app.js             # JavaScript separado (evita problemas CSP) básico para probar la aplicación
└── tasks.db              # Base de datos SQLite (se crea automáticamente)
```

## 🛠️ Tecnologías Utilizadas

- **Node.js**: Entorno de ejecución
- **Express.js**: Framework web para la API REST
- **Socket.IO**: WebSockets para comunicación en tiempo real
- **SQLite3**: Base de datos ligera
- **HTML/CSS/JavaScript**: Frontend básico
- **Helmet**: Middleware de seguridad
- **CORS**: Cross-Origin Resource Sharing

## 📦 Instalación y Configuración

### Prerequisitos

- Node.js (versión 14 o superior)
- npm (viene incluido con Node.js)

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   git clone <url-del-repositorio>
   cd todo-api-realtime
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar la aplicación**
   ```bash
   # Modo producción
   npm start
   
   # Modo desarrollo (con auto-reload)
   npm run dev
   ```

4. **Acceder a la aplicación**
   - API: `http://localhost:3000`
   - Frontend: `http://localhost:3000`
   - WebSocket: `ws://localhost:3000`

## 📚 Documentación de la API

### Endpoints Disponibles

#### 1. Crear Tarea
- **URL**: `POST /tasks`
- **Body**: 
  ```json
  {
    "titulo": "string (obligatorio, max 100 caracteres)",
    "descripcion": "string (opcional, max 500 caracteres)"
  }
  ```
- **Respuesta exitosa** (201):
  ```json
  {
    "message": "Tarea creada exitosamente",
    "task": {
      "id": 1,
      "titulo": "Mi tarea",
      "descripcion": "Descripción de la tarea",
      "status": "pendiente",
      "fechaCreacion": "2024-01-01T10:00:00.000Z",
      "fechaActualizacion": "2024-01-01T10:00:00.000Z"
    }
  }
  ```

#### 2. Obtener Todas las Tareas
- **URL**: `GET /tasks`
- **Respuesta exitosa** (200):
  ```json
  {
    "message": "Tareas obtenidas exitosamente",
    "tasks": [...],
    "count": 5
  }
  ```

#### 3. Actualizar Estado de Tarea
- **URL**: `PUT /tasks/:id`
- **Body**:
  ```json
  {
    "status": "completada" // pendiente, en_progreso, completada, cancelada
  }
  ```
- **Respuesta exitosa** (200):
  ```json
  {
    "message": "Estado de la tarea actualizado exitosamente",
    "task": { ... }
  }
  ```

#### 4. Eliminar Tarea
- **URL**: `DELETE /tasks/:id`
- **Respuesta exitosa** (200):
  ```json
  {
    "message": "Tarea eliminada exitosamente",
    "deletedTaskId": 1
  }
  ```

### Estados Válidos para Tareas

- `pendiente` (por defecto)
- `en_progreso`
- `completada`
- `cancelada`

## 🌐 WebSockets - Eventos en Tiempo Real

### Eventos que Emite el Servidor

#### 1. `initialTasks`
Se envía cuando un cliente se conecta por primera vez.
```javascript
socket.emit('initialTasks', tasks);
```

#### 2. `newTask`
Se emite cuando se crea una nueva tarea.
```javascript
socket.emit('newTask', task);
```

#### 3. `taskUpdated`
Se emite cuando se actualiza el estado de una tarea.
```javascript
socket.emit('taskUpdated', {
  id: taskId,
  status: newStatus,
  task: updatedTask
});
```

#### 4. `taskDeleted`
Se emite cuando se elimina una tarea.
```javascript
socket.emit('taskDeleted', { id: taskId });
```

## ⚠️ Nota sobre Content Security Policy

Si experimentas problemas con extensiones del navegador que bloquean JavaScript, la aplicación está diseñada con JavaScript separado en `public/app.js` para evitar problemas de CSP. Como alternativa, puedes:

1. **Usar modo incógnito** (recomendado para evaluación)
2. **Desactivar extensiones temporalmente**
3. El código está optimizado para funcionar sin JavaScript inline

---

### Opción 1: Usando el Frontend Incluido

1. Inicia el servidor: `npm start`
2. Abre `http://localhost:3000` en múltiples pestañas
3. Crea, actualiza y elimina tareas en una pestaña
4. Observa cómo se sincronizan automáticamente en las otras pestañas

### Opción 2: Usando cURL para la API

```bash
# Crear una tarea
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"titulo": "Mi primera tarea", "descripcion": "Esta es una tarea de prueba"}'

# Obtener todas las tareas
curl http://localhost:3000/tasks

# Actualizar estado de una tarea
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "completada"}'

# Eliminar una tarea
curl -X DELETE http://localhost:3000/tasks/1
```

### Opción 3: Usando Postman

1. Importa las siguientes URLs:
   - `POST http://localhost:3000/tasks`
   - `GET http://localhost:3000/tasks`
   - `PUT http://localhost:3000/tasks/1`
   - `DELETE http://localhost:3000/tasks/1`

2. Para WebSockets, puedes usar herramientas como:
   - Postman WebSocket client
   - `wscat`: `npm install -g wscat && wscat -c ws://localhost:3000`

### Opción 4: Código JavaScript para Probar WebSockets

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Conectado al servidor');
});

socket.on('newTask', (task) => {
  console.log('Nueva tarea recibida:', task);
});

socket.on('taskUpdated', (data) => {
  console.log('Tarea actualizada:', data);
});

socket.on('taskDeleted', (data) => {
  console.log('Tarea eliminada:', data);
});
```

## 🔧 Decisiones de Diseño

### Base de Datos
- **SQLite**: Elegida por su simplicidad de configuración y capacidades suficientes para el alcance del proyecto
- **Estructura de tabla**: Incluye validaciones a nivel de base de datos para integridad de datos
- **Timestamps automáticos**: `fechaCreacion` y `fechaActualizacion` gestionados automáticamente

### API REST
- **Códigos de estado HTTP apropiados**: 200, 201, 400, 404, 500
- **Validación robusta**: Middleware personalizado para validar datos de entrada
- **Manejo de errores**: Respuestas consistentes y informativas
- **Seguridad**: Helmet.js para headers de seguridad, CORS configurado

### WebSockets
- **Socket.IO**: Elegido sobre WebSockets nativos por su robustez y fallback automático
- **Eventos semánticos**: Nombres descriptivos para cada tipo de evento
- **Sincronización inicial**: Los clientes reciben todas las tareas al conectarse

### Frontend
- **SPA simple**: Una sola página con JavaScript vanilla
- **Responsive design**: Adaptable a diferentes tamaños de pantalla
- **Feedback visual**: Notificaciones y estados de conexión claros
- **UX moderna**: Diseño limpio con animaciones sutiles

## ⚠️ Consideraciones de Producción

Para usar en producción, considera implementar:

1. **Autenticación y autorización** de usuarios
2. **Rate limiting** para prevenir abuso de la API
3. **Logging** robusto con herramientas como Winston
4. **Variables de entorno** para configuración
5. **Base de datos más robusta** como PostgreSQL
6. **Tests unitarios e integración**
7. **Monitoreo y métricas**
8. **SSL/HTTPS** para comunicación segura

## 🚦 Scripts Disponibles

```bash
npm start     # Iniciar servidor en modo producción
npm run dev   # Iniciar servidor en modo desarrollo con nodemon
npm test      # Ejecutar tests
```

## 🐛 Manejo de Errores

La aplicación incluye manejo robusto de errores:

- **Validación de entrada**: Verificación de tipos y longitudes
- **Errores de base de datos**: Captura y manejo apropiado
- **Errores de red**: Timeouts y reconexión automática en WebSockets
- **Códigos de estado HTTP**: Respuestas apropiadas para cada situación
- **Logs detallados**: Para debugging y monitoreo

## 📝 Licencia

MIT License - Siéntete libre de usar este código para tus proyectos.

---

**Desarrollado como prueba técnica para demostrar habilidades en Node.js, Express, SQLite y WebSockets.**