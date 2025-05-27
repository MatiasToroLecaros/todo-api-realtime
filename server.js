const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const Database = require('./database');

console.log('🚀 Iniciando servidor...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3000;
const db = new Database();

// Middlewares de seguridad y configuración
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de logging para todas las requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  next();
});

// Middleware de validación para tareas
const validateTask = (req, res, next) => {
  console.log('🔍 Validando tarea:', req.body);
  
  const { titulo, descripcion } = req.body;
  
  if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
    console.log('❌ Validación falló: título inválido');
    return res.status(400).json({
      error: 'El título es obligatorio y debe ser una cadena de texto'
    });
  }
  
  if (titulo.length > 100) {
    console.log('❌ Validación falló: título muy largo');
    return res.status(400).json({
      error: 'El título no puede exceder los 100 caracteres'
    });
  }
  
  if (descripcion && (typeof descripcion !== 'string' || descripcion.length > 500)) {
    console.log('❌ Validación falló: descripción inválida');
    return res.status(400).json({
      error: 'La descripción debe ser una cadena de texto de máximo 500 caracteres'
    });
  }
  
  console.log('✅ Validación exitosa');
  next();
};

// Middleware de validación para actualizar estado
const validateStatus = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['pendiente', 'completada', 'en_progreso', 'cancelada'];
  
  console.log('🔍 Validando estado:', status);
  
  if (!status || typeof status !== 'string') {
    console.log('❌ Estado inválido: no es string');
    return res.status(400).json({
      error: 'El estado es obligatorio y debe ser una cadena de texto'
    });
  }
  
  if (!validStatuses.includes(status)) {
    console.log('❌ Estado inválido: no está en la lista permitida');
    return res.status(400).json({
      error: `Estado inválido. Estados válidos: ${validStatuses.join(', ')}`
    });
  }
  
  console.log('✅ Estado válido');
  next();
};

// RUTAS DE LA API

// POST /tasks - Crear una nueva tarea
app.post('/tasks', validateTask, async (req, res) => {
  console.log('📝 POST /tasks recibido:', req.body);
  
  try {
    const { titulo, descripcion } = req.body;
    console.log('🔄 Creando tarea en BD...');
    
    const taskId = await db.createTask(titulo.trim(), descripcion?.trim() || null);
    console.log('✅ Tarea creada con ID:', taskId);
    
    const newTask = await db.getTaskById(taskId);
    console.log('📄 Tarea completa obtenida:', newTask);
    
    // Emitir evento WebSocket a todos los clientes conectados
    console.log('📡 Emitiendo evento WebSocket newTask...');
    io.emit('newTask', newTask);
    console.log('📡 Evento WebSocket emitido exitosamente');
    
    res.status(201).json({
      message: 'Tarea creada exitosamente',
      task: newTask
    });
    
    console.log('✅ Respuesta enviada al cliente');
    
  } catch (error) {
    console.error('❌ Error al crear tarea:', error);
    res.status(500).json({
      error: 'Error interno del servidor al crear la tarea'
    });
  }
});

// GET /tasks - Obtener todas las tareas
app.get('/tasks', async (req, res) => {
  console.log('📋 GET /tasks recibido');
  
  try {
    const tasks = await db.getAllTasks();
    console.log(`📊 ${tasks.length} tareas obtenidas de la BD`);
    
    res.status(200).json({
      message: 'Tareas obtenidas exitosamente',
      tasks: tasks,
      count: tasks.length
    });
    
    console.log('✅ Tareas enviadas al cliente');
    
  } catch (error) {
    console.error('❌ Error al obtener tareas:', error);
    res.status(500).json({
      error: 'Error interno del servidor al obtener las tareas'
    });
  }
});

// PUT /tasks/:id - Actualizar el estado de una tarea
app.put('/tasks/:id', validateStatus, async (req, res) => {
  console.log(`🔄 PUT /tasks/${req.params.id} recibido:`, req.body);
  
  try {
    const taskId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(taskId) || taskId <= 0) {
      console.log('❌ ID de tarea inválido:', req.params.id);
      return res.status(400).json({
        error: 'ID de tarea inválido'
      });
    }
    
    // Verificar que la tarea existe
    console.log('🔍 Verificando que la tarea existe...');
    const existingTask = await db.getTaskById(taskId);
    if (!existingTask) {
      console.log('❌ Tarea no encontrada:', taskId);
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
    console.log('🔄 Actualizando estado en BD...');
    const updated = await db.updateTaskStatus(taskId, status);
    
    if (updated) {
      const updatedTask = await db.getTaskById(taskId);
      console.log('✅ Tarea actualizada:', updatedTask);
      
      // Emitir evento WebSocket a todos los clientes conectados
      console.log('📡 Emitiendo evento WebSocket taskUpdated...');
      io.emit('taskUpdated', {
        id: taskId,
        status: status,
        task: updatedTask
      });
      
      res.status(200).json({
        message: 'Estado de la tarea actualizado exitosamente',
        task: updatedTask
      });
    } else {
      console.log('❌ No se pudo actualizar la tarea');
      res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
  } catch (error) {
    console.error('❌ Error al actualizar tarea:', error);
    res.status(500).json({
      error: 'Error interno del servidor al actualizar la tarea'
    });
  }
});

// DELETE /tasks/:id - Eliminar una tarea
app.delete('/tasks/:id', async (req, res) => {
  console.log(`🗑️ DELETE /tasks/${req.params.id} recibido`);
  
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId) || taskId <= 0) {
      console.log('❌ ID de tarea inválido:', req.params.id);
      return res.status(400).json({
        error: 'ID de tarea inválido'
      });
    }
    
    // Verificar que la tarea existe antes de eliminar
    const existingTask = await db.getTaskById(taskId);
    if (!existingTask) {
      console.log('❌ Tarea no encontrada para eliminar:', taskId);
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
    console.log('🗑️ Eliminando tarea de BD...');
    const deleted = await db.deleteTask(taskId);
    
    if (deleted) {
      console.log('✅ Tarea eliminada exitosamente');
      
      // Emitir evento WebSocket a todos los clientes conectados
      console.log('📡 Emitiendo evento WebSocket taskDeleted...');
      io.emit('taskDeleted', { id: taskId });
      
      res.status(200).json({
        message: 'Tarea eliminada exitosamente',
        deletedTaskId: taskId
      });
    } else {
      console.log('❌ No se pudo eliminar la tarea');
      res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
  } catch (error) {
    console.error('❌ Error al eliminar tarea:', error);
    res.status(500).json({
      error: 'Error interno del servidor al eliminar la tarea'
    });
  }
});

// Ruta para servir el frontend básico
app.get('/', (req, res) => {
  console.log('🏠 Sirviendo frontend index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  console.log('❌ Ruta no encontrada:', req.originalUrl);
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

// Manejo de errores globales
app.use((error, req, res, next) => {
  console.error('💥 Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor'
  });
});

// WEBSOCKETS
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`🔌 Cliente conectado: ${socket.id} (Total: ${connectedClients})`);
  
  // Enviar las tareas existentes al cliente recién conectado
  console.log('📤 Enviando tareas iniciales al cliente...');
  db.getAllTasks().then(tasks => {
    console.log(`📊 Enviando ${tasks.length} tareas iniciales a ${socket.id}`);
    socket.emit('initialTasks', tasks);
  }).catch(error => {
    console.error('❌ Error al obtener tareas iniciales:', error);
  });
  
  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`🔌 Cliente desconectado: ${socket.id} (Total: ${connectedClients})`);
  });
  
  // Manejar errores de socket
  socket.on('error', (error) => {
    console.error('❌ Error en socket:', error);
  });
});

// Inicializar la base de datos y el servidor
async function startServer() {
  try {
    console.log('🗄️ Inicializando base de datos...');
    await db.init();
    console.log('✅ Base de datos inicializada correctamente');
    
    server.listen(PORT, () => {
      console.log('🎉 ¡Servidor iniciado exitosamente!');
      console.log(`🌐 HTTP: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log('📝 Logs detallados habilitados para debug');
    });
    
  } catch (error) {
    console.error('💥 Error al inicializar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  db.close();
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  db.close();
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

console.log('⏳ Iniciando aplicación...');
startServer();