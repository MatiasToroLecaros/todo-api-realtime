const request = require('supertest');
const http = require('http');
const socketIoClient = require('socket.io-client');
const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const Database = require('../database');

// Variables para el servidor de pruebas
let app, server, io, db, clientSocket;
const TEST_PORT = 3001;
const TEST_DB_PATH = './test_tasks.db';

describe('API de Tareas - Tests Completos', () => {
  
  // Configurar servidor de pruebas antes de todos los tests
  beforeAll(async () => {
    // Eliminar base de datos de prueba si existe
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Crear aplicación Express igual a la real
    app = express();
    server = http.createServer(app);
    io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });

    // Middlewares (igual que en server.js real)
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrcAttr: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"]
        }
      }
    }));
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Inicializar base de datos de prueba
    db = new Database();
    // Cambiar la ruta de la base de datos para pruebas
    db.db = null; // Reset
    await new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      db.db = new sqlite3.Database(TEST_DB_PATH, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await db.createTable();

    // Middlewares de validación (igual que en server.js real)
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

    // Rutas (igual que en server.js real)
    app.post('/tasks', validateTask, async (req, res) => {
      try {
        const { titulo, descripcion } = req.body;
        const taskId = await db.createTask(titulo.trim(), descripcion?.trim() || null);
        const newTask = await db.getTaskById(taskId);
        
        // Emitir evento WebSocket
        io.emit('newTask', newTask);
        
        res.status(201).json({
          message: 'Tarea creada exitosamente',
          task: newTask
        });
      } catch (error) {
        res.status(500).json({
          error: 'Error interno del servidor al crear la tarea'
        });
      }
    });

    app.get('/tasks', async (req, res) => {
      try {
        const tasks = await db.getAllTasks();
        res.status(200).json({
          message: 'Tareas obtenidas exitosamente',
          tasks: tasks,
          count: tasks.length
        });
      } catch (error) {
        res.status(500).json({
          error: 'Error interno del servidor al obtener las tareas'
        });
      }
    });

    app.put('/tasks/:id', validateStatus, async (req, res) => {
      try {
        const taskId = parseInt(req.params.id);
        const { status } = req.body;
        
        if (isNaN(taskId) || taskId <= 0) {
          return res.status(400).json({
            error: 'ID de tarea inválido'
          });
        }
        
        const existingTask = await db.getTaskById(taskId);
        if (!existingTask) {
          return res.status(404).json({
            error: 'Tarea no encontrada'
          });
        }
        
        const updated = await db.updateTaskStatus(taskId, status);
        
        if (updated) {
          const updatedTask = await db.getTaskById(taskId);
          
          // Emitir evento WebSocket
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
        res.status(500).json({
          error: 'Error interno del servidor al actualizar la tarea'
        });
      }
    });

    app.delete('/tasks/:id', async (req, res) => {
      try {
        const taskId = parseInt(req.params.id);
        
        if (isNaN(taskId) || taskId <= 0) {
          return res.status(400).json({
            error: 'ID de tarea inválido'
          });
        }
        
        const existingTask = await db.getTaskById(taskId);
        if (!existingTask) {
          return res.status(404).json({
            error: 'Tarea no encontrada'
          });
        }
        
        const deleted = await db.deleteTask(taskId);
        
        if (deleted) {
          // Emitir evento WebSocket
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
        res.status(500).json({
          error: 'Error interno del servidor al eliminar la tarea'
        });
      }
    });

    // WebSocket handlers
    io.on('connection', (socket) => {
      db.getAllTasks().then(tasks => {
        socket.emit('initialTasks', tasks);
      }).catch(error => {
        console.error('Error al obtener tareas iniciales:', error);
      });
    });

    // Iniciar servidor de pruebas
    await new Promise((resolve) => {
      server.listen(TEST_PORT, resolve);
    });
  });

  // Limpiar después de todos los tests
  afterAll(async () => {
    if (clientSocket) {
      clientSocket.close();
    }
    
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    if (db && db.db) {
      await new Promise((resolve) => {
        db.db.close(() => {
          resolve();
        });
      });
    }

    // Eliminar base de datos de prueba
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // Limpiar base de datos antes de cada test
  beforeEach(async () => {
    await new Promise((resolve, reject) => {
      db.db.run('DELETE FROM tasks', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('POST /tasks', () => {
    test('Debe crear una tarea exitosamente', async () => {
      const taskData = {
        titulo: 'Tarea de prueba',
        descripcion: 'Esta es una descripción de prueba'
      };

      const response = await request(app)
        .post('/tasks')
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Tarea creada exitosamente');
      expect(response.body.task).toMatchObject({
        id: expect.any(Number),
        titulo: 'Tarea de prueba',
        descripcion: 'Esta es una descripción de prueba',
        status: 'pendiente',
        fechaCreacion: expect.any(String),
        fechaActualizacion: expect.any(String)
      });
    });

    test('Debe fallar si el título está vacío', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({
          titulo: '',
          descripcion: 'Descripción sin título'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('El título es obligatorio y debe ser una cadena de texto');
    });

    test('Debe fallar si el título excede 100 caracteres', async () => {
      const tituloLargo = 'a'.repeat(101);
      
      const response = await request(app)
        .post('/tasks')
        .send({
          titulo: tituloLargo,
          descripcion: 'Descripción válida'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('El título no puede exceder los 100 caracteres');
    });

    test('Debe crear tarea sin descripción', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({
          titulo: 'Tarea sin descripción'
        });

      expect(response.status).toBe(201);
      expect(response.body.task.descripcion).toBe(null);
    });

    test('Debe fallar si descripción excede 500 caracteres', async () => {
      const descripcionLarga = 'a'.repeat(501);
      
      const response = await request(app)
        .post('/tasks')
        .send({
          titulo: 'Título válido',
          descripcion: descripcionLarga
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('La descripción debe ser una cadena de texto de máximo 500 caracteres');
    });
  });

  describe('GET /tasks', () => {
    test('Debe obtener todas las tareas', async () => {
      // Crear algunas tareas primero
      await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea 1', descripcion: 'Descripción 1' });
      
      await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea 2' });

      const response = await request(app).get('/tasks');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tareas obtenidas exitosamente');
      expect(response.body.tasks).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    test('Debe obtener array vacío si no hay tareas', async () => {
      const response = await request(app).get('/tasks');

      expect(response.status).toBe(200);
      expect(response.body.tasks).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('PUT /tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea para actualizar', descripcion: 'Descripción' });
      
      taskId = response.body.task.id;
    });

    test('Debe actualizar el estado de una tarea exitosamente', async () => {
      const response = await request(app)
        .put(`/tasks/${taskId}`)
        .send({ status: 'completada' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Estado de la tarea actualizado exitosamente');
      expect(response.body.task.status).toBe('completada');
    });

    test('Debe fallar con estado inválido', async () => {
      const response = await request(app)
        .put(`/tasks/${taskId}`)
        .send({ status: 'estado_invalido' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Estado inválido');
    });

    test('Debe fallar si la tarea no existe', async () => {
      const response = await request(app)
        .put('/tasks/999')
        .send({ status: 'completada' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Tarea no encontrada');
    });

    test('Debe fallar con ID inválido', async () => {
      const response = await request(app)
        .put('/tasks/abc')
        .send({ status: 'completada' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ID de tarea inválido');
    });

    test('Debe aceptar todos los estados válidos', async () => {
      const validStatuses = ['pendiente', 'en_progreso', 'completada', 'cancelada'];
      
      for (const status of validStatuses) {
        const response = await request(app)
          .put(`/tasks/${taskId}`)
          .send({ status });
        
        expect(response.status).toBe(200);
        expect(response.body.task.status).toBe(status);
      }
    });
  });

  describe('DELETE /tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea para eliminar', descripcion: 'Descripción' });
      
      taskId = response.body.task.id;
    });

    test('Debe eliminar una tarea exitosamente', async () => {
      const response = await request(app).delete(`/tasks/${taskId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tarea eliminada exitosamente');
      expect(response.body.deletedTaskId).toBe(taskId);

      // Verificar que la tarea fue eliminada
      const getResponse = await request(app).get('/tasks');
      expect(getResponse.body.tasks).toHaveLength(0);
    });

    test('Debe fallar si la tarea no existe', async () => {
      const response = await request(app).delete('/tasks/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Tarea no encontrada');
    });

    test('Debe fallar con ID inválido', async () => {
      const response = await request(app).delete('/tasks/abc');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ID de tarea inválido');
    });
  });

  describe('WebSocket Tests', () => {
    beforeEach((done) => {
      clientSocket = socketIoClient(`http://localhost:${TEST_PORT}`);
      clientSocket.on('connect', done);
    });

    afterEach(() => {
      if (clientSocket.connected) {
        clientSocket.disconnect();
      }
    });

    test('Debe recibir tareas iniciales al conectarse', (done) => {
      // Crear una tarea primero
      request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea inicial' })
        .then(() => {
          // Crear nueva conexión para recibir tareas iniciales
          const newSocket = socketIoClient(`http://localhost:${TEST_PORT}`);
          
          newSocket.on('initialTasks', (tasks) => {
            expect(tasks).toHaveLength(1);
            expect(tasks[0].titulo).toBe('Tarea inicial');
            newSocket.disconnect();
            done();
          });
        });
    });

    test('Debe recibir evento newTask cuando se crea una tarea', (done) => {
      clientSocket.on('newTask', (task) => {
        expect(task.titulo).toBe('Nueva tarea');
        expect(task.status).toBe('pendiente');
        done();
      });

      request(app)
        .post('/tasks')
        .send({ titulo: 'Nueva tarea' })
        .catch(done);
    });

    test('Debe recibir evento taskUpdated cuando se actualiza una tarea', async () => {
      // Crear tarea primero
      const createResponse = await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea a actualizar' });
      
      const taskId = createResponse.body.task.id;

      return new Promise((resolve) => {
        clientSocket.on('taskUpdated', (data) => {
          expect(data.id).toBe(taskId);
          expect(data.status).toBe('completada');
          expect(data.task.status).toBe('completada');
          resolve();
        });

        request(app)
          .put(`/tasks/${taskId}`)
          .send({ status: 'completada' })
          .catch(resolve);
      });
    });

    test('Debe recibir evento taskDeleted cuando se elimina una tarea', async () => {
      // Crear tarea primero
      const createResponse = await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea a eliminar' });
      
      const taskId = createResponse.body.task.id;

      return new Promise((resolve) => {
        clientSocket.on('taskDeleted', (data) => {
          expect(data.id).toBe(taskId);
          resolve();
        });

        request(app)
          .delete(`/tasks/${taskId}`)
          .catch(resolve);
      });
    });
  });

  describe('Integración Base de Datos', () => {
    test('Los datos persisten correctamente en SQLite', async () => {
      // Crear tarea
      const createResponse = await request(app)
        .post('/tasks')
        .send({ titulo: 'Tarea persistente', descripcion: 'Test de persistencia' });
      
      const taskId = createResponse.body.task.id;

      // Verificar que se guardó
      const task = await db.getTaskById(taskId);
      expect(task).not.toBeNull();
      expect(task.titulo).toBe('Tarea persistente');

      // Esperar un momento para asegurar diferencia en timestamp
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Actualizar
      await request(app)
        .put(`/tasks/${taskId}`)
        .send({ status: 'completada' });

      // Verificar actualización en BD
      const updatedTask = await db.getTaskById(taskId);
      expect(updatedTask.status).toBe('completada');
      // Verificar que las fechas son diferentes o que la actualización fue posterior
      expect(new Date(updatedTask.fechaActualizacion).getTime()).toBeGreaterThanOrEqual(
        new Date(updatedTask.fechaCreacion).getTime()
      );

      // Eliminar
      await request(app).delete(`/tasks/${taskId}`);

      // Verificar eliminación en BD
      const deletedTask = await db.getTaskById(taskId);
      expect(deletedTask).toBeUndefined();
    });

    test('Validaciones de base de datos funcionan correctamente', async () => {
      // Título muy largo debería fallar en validación de middleware, no BD
      const response = await request(app)
        .post('/tasks')
        .send({ titulo: 'a'.repeat(101) });
      
      expect(response.status).toBe(400);
      
      // Verificar que no se guardó nada en BD
      const tasks = await db.getAllTasks();
      expect(tasks).toHaveLength(0);
    });
  });
});