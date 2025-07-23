// Enhanced user storage with proper data separation
let users = {};
let currentUser = null;
let isLoginMode = true;

// Load users from localStorage on page load
function loadUsers() {
    const savedUsers = localStorage.getItem('taskmaster_users');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    }
}

// Save users to localStorage
function saveUsers() {
    localStorage.setItem('taskmaster_users', JSON.stringify(users));
}

// Initialize users data
loadUsers();

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    
    if (isLoginMode) {
        document.getElementById('formTitle').textContent = 'Welcome Back';
        document.getElementById('formSubtitle').textContent = 'Sign in to your account';
        document.getElementById('authButton').textContent = 'Sign In';
        document.querySelector('.auth-link').textContent = "Don't have an account? Register";
    } else {
        document.getElementById('formTitle').textContent = 'Join TaskMaster';
        document.getElementById('formSubtitle').textContent = 'Create your account';
        document.getElementById('authButton').textContent = 'Create Account';
        document.querySelector('.auth-link').textContent = "Already have an account? Sign In";
    }
    
    // Clear form
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function handleAuth() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (isLoginMode) {
        // Login
        if (!users[username]) {
            showNotification('Username not found!', 'error');
            return;
        }
        
        if (users[username].password !== password) {
            showNotification('Invalid password!', 'error');
            return;
        }
        
        loginSuccess(username);
    } else {
        // Register
        if (users[username]) {
            showNotification('Username already exists!', 'error');
            return;
        }
        
        // Create new user with empty task data
        users[username] = {
            password: password,
            tasks: [],
            undoStack: [],
            completedCount: 0
        };
        
        saveUsers();
        showNotification('Account created successfully!', 'success');
        
        // Auto-login after registration
        setTimeout(() => {
            loginSuccess(username);
        }, 1000);
    }
}

function loginSuccess(username) {
    currentUser = username;
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('taskMasterSection').classList.remove('hidden');
    
    // Update welcome message
    document.getElementById('welcomeMessage').textContent = `Welcome back, ${username}! Ready to manage your tasks?`;
    
    // Initialize scheduler with user's data
    scheduler.loadUserData(username);
    
    showNotification(`Welcome back, ${username}!`, 'success');
}

function logout() {
    currentUser = null;
    document.getElementById('taskMasterSection').classList.add('hidden');
    document.getElementById('authSection').style.display = 'block';
    
    // Clear form
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // Reset to login mode
    if (!isLoginMode) {
        toggleAuthMode();
    }
    
    showNotification('Logged out successfully', 'success');
}

// Enhanced Task Classes with user-specific data management************************************************************************************
class Task {
    constructor(name, deadlineDays, priority, timeRequired) {
        this.name = name;
        this.deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
        this.priority = priority;
        this.timeRequired = timeRequired;
        this.id = Date.now() + Math.random();
    }

    getDaysLeft() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(this.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        
        const diffTime = deadlineDate - now;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return daysLeft;
    }

    isDueSoon() {
        const daysLeft = this.getDaysLeft();
        return daysLeft <= 2;
    }

    getPriorityClass() {
        if (this.priority >= 8) return 'priority-high';
        if (this.priority >= 5) return 'priority-medium';
        return 'priority-low';
    }

    getPriorityText() {
        if (this.priority >= 8) return 'High';
        if (this.priority >= 5) return 'Medium';
        return 'Low';
    }
}
//***************************************************************************************************************************************
class TaskScheduler {
    constructor() {
        this.tasks = [];
        this.undoStack = [];
        this.sortOrder = 'deadline';
        this.completedCount = 0;
    }

    // Load user-specific data
    loadUserData(username) {
        if (users[username]) {
            // Convert saved task data back to Task objects
            this.tasks = users[username].tasks.map(taskData => {
                const task = new Task(taskData.name, 0, taskData.priority, taskData.timeRequired);
                task.deadline = new Date(taskData.deadline);
                task.id = taskData.id;
                return task;
            });
            
            // Load undo stack
            this.undoStack = users[username].undoStack.map(taskData => {
                const task = new Task(taskData.name, 0, taskData.priority, taskData.timeRequired);
                task.deadline = new Date(taskData.deadline);
                task.id = taskData.id;
                return task;
            });
            
            this.completedCount = users[username].completedCount || 0;
        } else {
            // New user - empty data
            this.tasks = [];
            this.undoStack = [];
            this.completedCount = 0;
        }
        
        this.renderTasks();
        this.updateStats();
    }

    // Save user-specific data
    saveUserData() {
        if (currentUser && users[currentUser]) {
            users[currentUser].tasks = this.tasks;
            users[currentUser].undoStack = this.undoStack;
            users[currentUser].completedCount = this.completedCount;
            saveUsers();
        }
    }

    addTask(name, deadline, priority, time) {
        const task = new Task(name, deadline, priority, time);
        this.tasks.push(task);
        this.saveUserData();
        this.renderTasks();
        this.updateStats();
        this.showNotification('Task added successfully!', 'success');
        return true;
    }

    removeTask(name) {
        const index = this.tasks.findIndex(task => task.name === name);
        if (index === -1) {
            this.showNotification('Task not found!', 'error');
            return false;
        }
        this.tasks.splice(index, 1);
        this.saveUserData();
        this.renderTasks();
        this.updateStats();
        this.showNotification('Task removed successfully!', 'success');
        return true;
    }

    executeNextTask() {
        if (this.tasks.length === 0) {
            this.showNotification('No tasks available!', 'error');
            return;
        }

        const sortedTasks = this.getSortedTasks();
        const nextTask = sortedTasks[0];
        
        this.undoStack.push(nextTask);
        this.tasks = this.tasks.filter(task => task.id !== nextTask.id);
        this.completedCount++;
        
        this.saveUserData();
        this.renderTasks();
        this.updateStats();
        this.showNotification(`Executed: ${nextTask.name}`, 'success');
    }

    undoLastTask() {
        if (this.undoStack.length === 0) {
            this.showNotification('No task to undo!', 'error');
            return;
        }

        const task = this.undoStack.pop();
        this.tasks.push(task);
        this.completedCount--;
        
        this.saveUserData();
        this.renderTasks();
        this.updateStats();
        this.showNotification(`Undone: ${task.name}`, 'success');
    }
//****************************************************************************************************************************************** */
    getSortedTasks() {
        return [...this.tasks].sort((a, b) => {
            // Primary sort by current sort order
            let primaryCompare = 0;
            if (this.sortOrder === 'deadline') {
                primaryCompare = a.deadline - b.deadline;
            } else if (this.sortOrder === 'priority') {
                primaryCompare = b.priority - a.priority;
            } else if (this.sortOrder === 'time') {
                primaryCompare = a.timeRequired - b.timeRequired;
            }
            
            // If primary sort is equal, use secondary sorting
            if (primaryCompare !== 0) {
                return primaryCompare;
            }
            
            // Secondary sort: if primary was deadline, sort by priority; if priority, sort by deadline; if time, sort by deadline
            let secondaryCompare = 0;
            if (this.sortOrder === 'deadline') {
                secondaryCompare = b.priority - a.priority; // Higher priority first
            } else if (this.sortOrder === 'priority') {
                secondaryCompare = a.deadline - b.deadline; // Earlier deadline first
            } else if (this.sortOrder === 'time') {
                secondaryCompare = a.deadline - b.deadline; // Earlier deadline first
            }
            
            // If secondary sort is equal, use tertiary sorting
            if (secondaryCompare !== 0) {
                return secondaryCompare;
            }
            
            // Tertiary sort: use the remaining criteria
            if (this.sortOrder === 'deadline') {
                return a.timeRequired - b.timeRequired; // Less time first
            } else if (this.sortOrder === 'priority') {
                return a.timeRequired - b.timeRequired; // Less time first
            } else if (this.sortOrder === 'time') {
                return b.priority - a.priority; // Higher priority first
            }
            
            return 0;
        });
    }

    renderTasks() {
        const taskList = document.getElementById('taskList');
        const sortedTasks = this.getSortedTasks();

        if (sortedTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <h3>No tasks yet</h3>
                    <p>Add your first task to get started!</p>
                </div>
            `;
            return;
        }

        taskList.innerHTML = sortedTasks.map((task, index) => {
            const daysLeft = task.getDaysLeft();
            const urgentClass = task.isDueSoon() ? 'urgent' : '';
            let deadlineText = '';
            
            if (daysLeft === 0) {
                deadlineText = '🚨 Due Today';
            } else if (daysLeft < 0) {
                deadlineText = `❌ Overdue by ${Math.abs(daysLeft)} day(s)`;
            } else if (daysLeft === 1) {
                deadlineText = '⚠️ Due Tomorrow';
            } else {
                deadlineText = `📅 ${daysLeft} day(s) left`;
            }
            
            return `
                <div class="task-item ${task.getPriorityClass()} ${urgentClass}">
                    <div class="task-header">
                        <div class="task-name">${task.name}</div>
                        <div class="task-priority">${task.getPriorityText()}</div>
                    </div>
                    <div class="task-details">
                        <span>${deadlineText}</span>
                        <span>⭐ Priority: ${task.priority}</span>
                        <span>⏱️ ${task.timeRequired} hour(s)</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateStats() {
        document.getElementById('totalTasks').textContent = this.tasks.length;
        document.getElementById('highPriorityTasks').textContent = 
            this.tasks.filter(task => task.priority >= 8).length;
        document.getElementById('urgentTasks').textContent = 
            this.tasks.filter(task => task.isDueSoon()).length;
        document.getElementById('completedTasks').textContent = this.completedCount;
    }
//*************************************************************************************************************************** */
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    saveTasks() {
        const data = {
            tasks: this.tasks,
            undoStack: this.undoStack,
            completedCount: this.completedCount
        };
        // In a real environment, this would use localStorage
        // For the artifact, we'll just keep it in memory
    }

    loadTasks() {
        // In a real environment, this would load from localStorage
        // For the artifact, we'll start with empty data
        this.renderTasks();
        this.updateStats();
    }
}

// Initialize the task scheduler
const scheduler = new TaskScheduler();

// Event handlers
function openAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'block';
}

function openRemoveTaskModal() {
    document.getElementById('removeTaskModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function executeNextTask() {
    scheduler.executeNextTask();
}

function undoLastTask() {
    scheduler.undoLastTask();
}

function toggleSortView() {
    const sortControls = document.getElementById('sortControls');
    sortControls.style.display = sortControls.style.display === 'none' ? 'block' : 'none';
}

function setSortOrder(order) {
    scheduler.sortOrder = order;
    scheduler.renderTasks();
    
    // Update active sort option
    document.querySelectorAll('.sort-option').forEach(option => {
        option.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Form submissions
document.getElementById('addTaskForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('taskName').value;
    const deadline = parseInt(document.getElementById('taskDeadline').value);
    const priority = parseInt(document.getElementById('taskPriority').value);
    const time = parseFloat(document.getElementById('taskTime').value);

    if (scheduler.addTask(name, deadline, priority, time)) {
        this.reset();
        closeModal('addTaskModal');
    }
});

document.getElementById('removeTaskForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('removeTaskName').value;
    
    if (scheduler.removeTask(name)) {
        this.reset();
        closeModal('removeTaskModal');
    }
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
}

