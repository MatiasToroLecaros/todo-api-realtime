const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  // Inicializar la conexión a la base de datos
  async init() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, 'tasks.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error al conectar con la base de datos:', err.message);
          reject(err);
        } else {
          console.log('Conectado a la base de datos SQLite');
          this.createTable().then(resolve).catch(reject);
        }
      });
    });
  }

  // Crear la tabla de tareas si no existe
  async createTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          titulo TEXT NOT NULL CHECK(length(titulo) <= 100),
          descripcion TEXT CHECK(length(descripcion) <= 500),
          status TEXT DEFAULT 'pendiente',
          fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
          fechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(sql, (err) => {
        if (err) {
          console.error('Error al crear la tabla:', err.message);
          reject(err);
        } else {
          console.log('Tabla de tareas creada/verificada correctamente');
          resolve();
        }
      });
    });
  }

  // Crear una nueva tarea
  async createTask(titulo, descripcion = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tasks (titulo, descripcion)
        VALUES (?, ?)
      `;

      this.db.run(sql, [titulo, descripcion], function(err) {
        if (err) {
          reject(err);
        } else {
          // Obtener la tarea recién creada
          resolve(this.lastID);
        }
      });
    });
  }

  // Obtener tarea por ID
  async getTaskById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tasks WHERE id = ?`;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Obtener todas las tareas
  async getAllTasks() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tasks 
        ORDER BY fechaCreacion DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Actualizar el estado de una tarea
  async updateTaskStatus(id, status) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE tasks 
        SET status = ?, fechaActualizacion = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [status, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Eliminar una tarea
  async deleteTask(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM tasks WHERE id = ?`;

      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Cerrar la conexión
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error al cerrar la base de datos:', err.message);
        } else {
          console.log('Conexión a la base de datos cerrada');
        }
      });
    }
  }
}

module.exports = Database;