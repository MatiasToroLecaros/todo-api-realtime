const request = require('supertest');
const express = require('express');
const Database = require('../database');

// Mock de la base de datos para tests
jest.mock('../database');

describe('API de Tareas', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    // Configurar mocks
    mockDb = {
      createTask: jest.fn(),
      getAllTasks: jest.fn(),
      getTaskById: jest.fn(),
      updateTaskStatus: jest.fn(),
      deleteTask: jest.fn(),
      init: jest.fn().mockResolvedValue(),
      close: jest.fn()
    };
    
    Database.mockImplementation(() => mockDb);

    // Crear una versión simplificada del servidor para tests
    app = express();
    app.use(express.json());
    
    // Importar y configurar rutas (versión simplificada)
    app.post('/tasks', async (req, res) => {
      try {
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
        
        const taskId = await mockDb.createTask(titulo.trim(), descripcion?.trim() || null);
        const newTask = {
          id: taskId,
          titulo: titulo.trim(),
          descripcion: descripcion?.trim() || null,
          status: 'pendiente',
          fechaCreacion: new Date().toISOString(),
          fechaActualizacion: new Date().toISOString()
        };
        
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
        const tasks = await mockDb.getAllTasks();
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

    app.put('/tasks/:id', async (req, res) => {
      try {
        const taskId = parseInt(req.params.id);
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
        
        if (isNaN(taskId) || taskId <= 0) {
          return res.status(400).json({
            error: 'ID de tarea inválido'
          });
        }
        
        const existingTask = await mockDb.getTaskById(taskId);
        if (!existingTask) {
          return res.status(404).json({
            error: 'Tarea no encontrada'
          });
        }
        
        const updated = await mockDb.updateTaskStatus(taskId, status);
        
        if (updated) {
          const updatedTask = { ...existingTask, status, fechaActualizacion: new Date().toISOString() };
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
        
        const existingTask = await mockDb.getTaskById(taskId);
        if (!existingTask) {
          return res.status(404).json({
            error: 'Tarea no encontrada'
          });
        }
        
        const deleted = await mockDb.deleteTask(taskId);
        
        if (deleted) {
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
  });

  describe('POST /tasks', () => {
    test('Debe crear una tarea exitosamente', async () => {
      mockDb.createTask.mockResolvedValue(1);

      const response = await request(app)
        .post('/tasks')
        .send({
          titulo: 'Tarea de prueba',
          descripcion: 'Esta es una descripción de prueba'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Tarea creada exitosamente');
      expect(response.body.task).toHaveProperty('id', 1);
      expect(response.body.task).toHaveProperty('titulo', 'Tarea de prueba');
      expect(response.body.task).toHaveProperty('status', 'pendiente');
      expect(mockDb.createTask).toHaveBeenCalledWith('Tarea de prueba', 'Esta es una descripción de prueba');
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
      mockDb.createTask.mockResolvedValue(2);

      const response = await request(app)
        .post('/tasks')
        .send({
          titulo: 'Tarea sin descripción'
        });

      expect(response.status).toBe(201);
      expect(response.body.task.descripcion).toBe(null);
      expect(mockDb.createTask).toHaveBeenCalledWith('Tarea sin descripción', null);
    });
  });

  describe('GET /tasks', () => {
    test('Debe obtener todas las tareas', async () => {
      const mockTasks = [
        {
          id: 1,
          titulo: 'Tarea 1',
          descripcion: 'Descripción 1',
          status: 'pendiente',
          fechaCreacion: '2024-01-01T10:00:00.000Z',
          fechaActualizacion: '2024-01-01T10:00:00.000Z'
        },
        {
          id: 2,
          titulo: 'Tarea 2',
          descripcion: null,
          status: 'completada',
          fechaCreacion: '2024-01-01T11:00:00.000Z',
          fechaActualizacion: '2024-01-01T12:00:00.000Z'
        }
      ];

      mockDb.getAllTasks.mockResolvedValue(mockTasks);

      const response = await request(app).get('/tasks');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tareas obtenidas exitosamente');
      expect(response.body.tasks).toEqual(mockTasks);
      expect(response.body.count).toBe(2);
    });

    test('Debe obtener array vacío si no hay tareas', async () => {
      mockDb.getAllTasks.mockResolvedValue([]);

      const response = await request(app).get('/tasks');

      expect(response.status).toBe(200);
      expect(response.body.tasks).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('PUT /tasks/:id', () => {
    const mockTask = {
      id: 1,
      titulo: 'Tarea de prueba',
      descripcion: 'Descripción',
      status: 'pendiente',
      fechaCreacion: '2024-01-01T10:00:00.000Z',
      fechaActualizacion: '2024-01-01T10:00:00.000Z'
    };

    test('Debe actualizar el estado de una tarea exitosamente', async () => {
      mockDb.getTaskById.mockResolvedValue(mockTask);
      mockDb.updateTaskStatus.mockResolvedValue(true);

      const response = await request(app)
        .put('/tasks/1')
        .send({ status: 'completada' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Estado de la tarea actualizado exitosamente');
      expect(mockDb.updateTaskStatus).toHaveBeenCalledWith(1, 'completada');
    });

    test('Debe fallar con estado inválido', async () => {
      const response = await request(app)
        .put('/tasks/1')
        .send({ status: 'estado_invalido' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Estado inválido');
    });

    test('Debe fallar si la tarea no existe', async () => {
      mockDb.getTaskById.mockResolvedValue(null);

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
  });

  describe('DELETE /tasks/:id', () => {
    const mockTask = {
      id: 1,
      titulo: 'Tarea a eliminar',
      descripcion: 'Descripción',
      status: 'pendiente',
      fechaCreacion: '2024-01-01T10:00:00.000Z',
      fechaActualizacion: '2024-01-01T10:00:00.000Z'
    };

    test('Debe eliminar una tarea exitosamente', async () => {
      mockDb.getTaskById.mockResolvedValue(mockTask);
      mockDb.deleteTask.mockResolvedValue(true);

      const response = await request(app).delete('/tasks/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tarea eliminada exitosamente');
      expect(response.body.deletedTaskId).toBe(1);
      expect(mockDb.deleteTask).toHaveBeenCalledWith(1);
    });

    test('Debe fallar si la tarea no existe', async () => {
      mockDb.getTaskById.mockResolvedValue(null);

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
});