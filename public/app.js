class TaskManager {
    constructor() {
        this.socket = io();
        this.tasks = [];
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    initializeElements() {
        this.form = document.getElementById('taskForm');
        this.tasksList = document.getElementById('tasksList');
        this.taskCount = document.getElementById('taskCount');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.submitBtn = document.getElementById('submitBtn');
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.showNotification('Conectado al servidor', 'success');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
            this.showNotification('Desconectado del servidor', 'error');
        });

        this.socket.on('initialTasks', (tasks) => {
            this.tasks = tasks;
            this.renderTasks();
        });

        this.socket.on('newTask', (task) => {
            this.tasks.unshift(task);
            this.renderTasks();
            this.showNotification('Nueva tarea creada', 'success');
        });

        this.socket.on('taskUpdated', (data) => {
            const taskIndex = this.tasks.findIndex(t => t.id === data.id);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = data.task;
                this.renderTasks();
                this.showNotification(`Tarea actualizada a: ${data.status}`, 'info');
            }
        });

        this.socket.on('taskDeleted', (data) => {
            this.tasks = this.tasks.filter(t => t.id !== data.id);
            this.renderTasks();
            this.showNotification('Tarea eliminada', 'info');
        });
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.textContent = '🟢 Conectado';
            this.connectionStatus.className = 'connection-status connected';
            this.submitBtn.disabled = false;
        } else {
            this.connectionStatus.textContent = '🔴 Desconectado';
            this.connectionStatus.className = 'connection-status disconnected';
            this.submitBtn.disabled = true;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const titulo = formData.get('titulo').trim();
        const descripcion = formData.get('descripcion').trim();

        if (!titulo) {
            this.showNotification('El título es obligatorio', 'error');
            return;
        }

        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Creando...';

        try {
            const response = await fetch('/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    titulo,
                    descripcion: descripcion || null
                })
            });

            if (response.ok) {
                this.form.reset();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error al crear tarea', 'error');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'error');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = 'Crear Tarea';
        }
    }

    async updateTaskStatus(id, status) {
        if (!status) {
            return;
        }

        console.log(`🔄 Actualizando tarea ${id} a estado: ${status}`);

        try {
            const response = await fetch(`/tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status })
            });

            console.log('📡 Respuesta del servidor:', response.status);

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Error del servidor:', error);
                this.showNotification(error.error || 'Error al actualizar tarea', 'error');
            } else {
                const result = await response.json();
                console.log('✅ Tarea actualizada:', result);
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            this.showNotification('Error de conexión', 'error');
        }
    }

    async deleteTask(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
            return;
        }

        console.log(`🗑️ Eliminando tarea ${id}`);

        try {
            const response = await fetch(`/tasks/${id}`, {
                method: 'DELETE'
            });

            console.log('📡 Respuesta del servidor:', response.status);

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Error del servidor:', error);
                this.showNotification(error.error || 'Error al eliminar tarea', 'error');
            } else {
                const result = await response.json();
                console.log('✅ Tarea eliminada:', result);
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            this.showNotification('Error de conexión', 'error');
        }
    }

    renderTasks() {
        this.updateTaskCount();

        if (this.tasks.length === 0) {
            this.tasksList.innerHTML = `
                <div class="no-tasks">
                    <div>📋</div>
                    <h3>No hay tareas aún</h3>
                    <p>Crea tu primera tarea para comenzar</p>
                </div>
            `;
            return;
        }

        this.tasksList.innerHTML = this.tasks.map(task => `
            <div class="task-item" data-id="${task.id}">
                <div class="task-header">
                    <div>
                        <div class="task-title">${this.escapeHtml(task.titulo)}</div>
                        <span class="task-status status-${task.status}">${task.status}</span>
                    </div>
                </div>
                ${task.descripcion ? `<div class="task-description">${this.escapeHtml(task.descripcion)}</div>` : ''}
                <div class="task-meta">
                    <span>📅 Creada: ${this.formatDate(task.fechaCreacion)}</span>
                    <span>🔄 Actualizada: ${this.formatDate(task.fechaActualizacion)}</span>
                </div>
                <div class="task-actions">
                    <select class="task-select" data-task-id="${task.id}">
                        <option value="">Cambiar estado</option>
                        <option value="pendiente" ${task.status === 'pendiente' ? 'disabled' : ''}>Pendiente</option>
                        <option value="en_progreso" ${task.status === 'en_progreso' ? 'disabled' : ''}>En Progreso</option>
                        <option value="completada" ${task.status === 'completada' ? 'disabled' : ''}>Completada</option>
                        <option value="cancelada" ${task.status === 'cancelada' ? 'disabled' : ''}>Cancelada</option>
                    </select>
                    <button class="btn btn-small btn-delete" data-task-id="${task.id}">
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        `).join('');

        // Agregar event listeners después de crear el HTML
        this.attachEventListeners();
    }

    attachEventListeners() {
        console.log('🔗 Agregando event listeners...');
        
        // Event listeners para los selects de cambio de estado
        const statusSelects = this.tasksList.querySelectorAll('.task-select');
        console.log(`📋 Encontrados ${statusSelects.length} selects`);
        
        statusSelects.forEach((select, index) => {
            console.log(`🔗 Agregando listener al select ${index + 1}`);
            select.addEventListener('change', (e) => {
                console.log('📋 Select changed!', e.target.value);
                const taskId = parseInt(e.target.getAttribute('data-task-id'));
                const newStatus = e.target.value;
                
                console.log(`🔄 TaskID: ${taskId}, Nuevo estado: ${newStatus}`);
                
                if (newStatus) {
                    console.log(`🔄 Cambiando estado de tarea ${taskId} a: ${newStatus}`);
                    this.updateTaskStatus(taskId, newStatus);
                    // Resetear el select
                    e.target.value = '';
                }
            });
        });

        // Event listeners para los botones de eliminar
        const deleteButtons = this.tasksList.querySelectorAll('.btn-delete');
        console.log(`🗑️ Encontrados ${deleteButtons.length} botones de eliminar`);
        
        deleteButtons.forEach((button, index) => {
            console.log(`🔗 Agregando listener al botón ${index + 1}`);
            button.addEventListener('click', (e) => {
                console.log('🗑️ Delete button clicked!');
                const taskId = parseInt(e.target.getAttribute('data-task-id'));
                console.log(`🗑️ Eliminando tarea: ${taskId}`);
                this.deleteTask(taskId);
            });
        });
        
        console.log('✅ Event listeners agregados correctamente');
    }

    updateTaskCount() {
        const count = this.tasks.length;
        const pendientes = this.tasks.filter(t => t.status === 'pendiente').length;
        const completadas = this.tasks.filter(t => t.status === 'completada').length;
        
        this.taskCount.textContent = `${count} tarea${count !== 1 ? 's' : ''} (${pendientes} pendiente${pendientes !== 1 ? 's' : ''}, ${completadas} completada${completadas !== 1 ? 's' : ''})`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando TaskManager...');
    window.taskManager = new TaskManager();
});

// Función global para debugging
function testUpdate() {
    console.log('🧪 Función de prueba ejecutada');
    if (window.taskManager) {
        window.taskManager.updateTaskStatus(1, 'completada');
    }
}