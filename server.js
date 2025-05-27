const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const Database = require('./database');

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

// Middleware de validación para tareas
const validateTask = (req, res, next) => {
  const { titulo, descripcion } = req.body;
  
  if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
    return res.status(400).json({
      error: 'El título es obligatorio y debe ser una cadena de texto'
    });
  }
  
  if (titulo.length > 100) {
    return res.status(400).json({
      error: 'El título no puede exceder los 100 caracteres'
    });
  }
  
  if (descripcion && (typeof descripcion !== 'string' || descripcion.length > 500)) {
    return res.status(400).json({
      error: 'La descripción debe ser una cadena de texto de máximo 500 caracteres'
    });
  }
  
  next();
};

// Middleware de validación para actualizar estado
const validateStatus = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['pendiente', 'completada', 'en_progreso', 'cancelada'];
  
  if (!status || typeof status !== 'string') {
    return res.status(400).json({
      error: 'El estado es obligatorio y debe ser una cadena de texto'
    });
  }
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Estado inválido. Estados válidos: ${validStatuses.join(', ')}`
    });
  }
  
  next();
};

// RUTAS DE LA API

// POST /tasks - Crear una nueva tarea
app.post('/tasks', validateTask, async (req, res) => {
  try {
    const { titulo, descripcion } = req.body;
    
    const taskId = await db.createTask(titulo.trim(), descripcion?.trim() || null);
    const newTask = await db.getTaskById(taskId);
    
    // Emitir evento WebSocket a todos los clientes conectados
    io.emit('newTask', newTask);
    
    res.status(201).json({
      message: 'Tarea creada exitosamente',
      task: newTask
    });
    
  } catch (error) {
    console.error('Error al crear tarea:', error);
    res.status(500).json({
      error: 'Error interno del servidor al crear la tarea'
    });
  }
});

// GET /tasks - Obtener todas las tareas
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await db.getAllTasks();
    
    res.status(200).json({
      message: 'Tareas obtenidas exitosamente',
      tasks: tasks,
      count: tasks.length
    });
    
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({
      error: 'Error interno del servidor al obtener las tareas'
    });
  }
});

// PUT /tasks/:id - Actualizar el estado de una tarea
app.put('/tasks/:id', validateStatus, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({
        error: 'ID de tarea inválido'
      });
    }
    
    // Verificar que la tarea existe
    const existingTask = await db.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
    const updated = await db.updateTaskStatus(taskId, status);
    
    if (updated) {
      const updatedTask = await db.getTaskById(taskId);
      
      // Emitir evento WebSocket a todos los clientes conectados
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
      res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    res.status(500).json({
      error: 'Error interno del servidor al actualizar la tarea'
    });
  }
});

// DELETE /tasks/:id - Eliminar una tarea
app.delete('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({
        error: 'ID de tarea inválido'
      });
    }
    
    // Verificar que la tarea existe antes de eliminar
    const existingTask = await db.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
    const deleted = await db.deleteTask(taskId);
    
    if (deleted) {
      // Emitir evento WebSocket a todos los clientes conectados
      io.emit('taskDeleted', { id: taskId });
      
      res.status(200).json({
        message: 'Tarea eliminada exitosamente',
        deletedTaskId: taskId
      });
    } else {
      res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }
    
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    res.status(500).json({
      error: 'Error interno del servidor al eliminar la tarea'
    });
  }
});

// Ruta para servir el frontend básico
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

// Manejo de errores globales
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor'
  });
});

// WEBSOCKETS
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  
  // Enviar las tareas existentes al cliente recién conectado
  db.getAllTasks().then(tasks => {
    socket.emit('initialTasks', tasks);
  }).catch(error => {
    console.error('Error al obtener tareas iniciales:', error);
  });
  
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
  
  // Manejar errores de socket
  socket.on('error', (error) => {
    console.error('Error en socket:', error);
  });
});

// Inicializar la base de datos y el servidor
async function startServer() {
  try {
    await db.init();
    
    server.listen(PORT, () => {
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
      console.log(`WebSocket disponible en ws://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('Error al inicializar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  db.close();
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  db.close();
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});

startServer();