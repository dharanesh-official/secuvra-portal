import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, updatePassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, collection, getDocs, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase'; // Main app db
import { firebaseConfig } from '../firebase';
import Swal from 'sweetalert2';
import ProjectChat from './ProjectChat';

const AdminDashboard = ({ org, orgId, onLogout }) => {
    const user = getAuth().currentUser;
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [projects, setProjects] = useState([]); // Projects State
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'employees', 'projects'
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showProjectForm, setShowProjectForm] = useState(false); // Project Form Modal
    const [projectFormData, setProjectFormData] = useState({
        name: '',
        employeeId: '',
        amount: '',        // This will be the Employee Payout
        clientAmount: '',  // This is what the Client Pays (Admin only)
        clientEmail: '',
        clientPassword: ''
    });

    // Notification State
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    // Task Management State
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedChatProject, setSelectedChatProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [taskFormData, setTaskFormData] = useState({
        title: '',
        date: '',
        status: 'Not Started'
    });
    const [editingTask, setEditingTask] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        fetchEmployees();
        fetchProjects();
    }, [orgId]);

    const fetchEmployees = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "companies", orgId, "employees"));
            const empList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEmployees(empList);
        } catch (error) {
            console.error("Error fetching employees:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load employees.',
                background: '#1a1a2e',
                color: '#fff'
            });
        }
    };

    const fetchProjects = () => {
        const q = collection(db, "companies", orgId, "projects");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projList);
            checkNotifications(projList);
        }, (error) => {
            console.error("Error fetching projects:", error);
        });
        return unsubscribe; // Cleanup handled in useEffect? For simple dashboard usually fetch once, but here realtime
    };

    const checkNotifications = (projList) => {
        // Collect unread messages
        // Logic: if lastMessage exists and senderId != current userId (Admin is special, we don't know exact Admin UID in chat always, but let's assume senderRole)
        // Actually we do know admin UID from Auth.
        // For simplicity: Check local storage for "lastReadTime" per project or global?
        // User asked for "Clearable". So we check against a "clearedTime" or just show latest.

        // Better: Just show the last message of every project where sender is NOT me (Admin).
        // And filter out those explicitly "cleared" (tracked in state or local storage).
        // Since we want persistent "Clearable", let's use a simple in-memory list populated from valid projects, minus cleared ones.

        const newNotifs = [];
        const clearedNotifs = JSON.parse(localStorage.getItem(`cleared_notifs_${orgId}`) || '[]');

        projList.forEach(p => {
            if (p.lastMessage && p.lastMessage.senderId !== (getAuth().currentUser?.uid)) {
                // Check if this specific message timestamp is already cleared
                const msgTime = p.lastMessageAt?.toMillis() || Date.now();
                const notifId = `${p.id}_${msgTime}`;

                if (!clearedNotifs.includes(notifId)) {
                    newNotifs.push({
                        id: notifId,
                        projectId: p.id,
                        projectName: p.name,
                        text: p.lastMessage.text,
                        sender: p.lastMessage.senderName,
                        time: p.lastMessage.createdAt
                    });
                }
            }
        });
        setNotifications(newNotifs);
    };

    const clearNotification = (id) => {
        const cleared = JSON.parse(localStorage.getItem(`cleared_notifs_${orgId}`) || '[]');
        cleared.push(id);
        localStorage.setItem(`cleared_notifs_${orgId}`, JSON.stringify(cleared));
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const clearAllNotifications = () => {
        const cleared = JSON.parse(localStorage.getItem(`cleared_notifs_${orgId}`) || '[]');
        const ids = notifications.map(n => n.id);
        localStorage.setItem(`cleared_notifs_${orgId}`, JSON.stringify([...cleared, ...ids]));
        setNotifications([]);
    };

    const handleEditEmployee = (employee) => {
        setEditingEmployee(employee);
        setEditFormData({
            name: employee.name,
            phone: employee.phone,
            email: employee.email,
            address: employee.address
        });
    };

    const handleUpdateEmployee = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateDoc(doc(db, 'companies', orgId, 'employees', editingEmployee.id), {
                name: editFormData.name,
                phone: editFormData.phone,
                email: editFormData.email,
                address: editFormData.address,
                updatedAt: serverTimestamp()
            });
            setLoading(false);
            setEditingEmployee(null);
            fetchEmployees();
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Employee updated successfully.',
                background: '#1a1a2e',
                color: '#fff'
            });
        } catch (error) {
            setLoading(false);
            console.error('Error updating employee:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update employee.',
                background: '#1a1a2e',
                color: '#fff'
            });
        }
    };

    const handleDeleteEmployee = async (employee) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to permanently delete ${employee.name}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete',
            background: '#1a1a2e',
            color: '#fff'
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                // Delete from Firestore
                await deleteDoc(doc(db, 'companies', orgId, 'employees', employee.id));

                // Delete from Auth if possible (requires secondary app)
                const appName = `DeleteApp-${Date.now()}`;
                const secondaryApp = initializeApp(firebaseConfig, appName);
                const secondaryAuth = getAuth(secondaryApp);
                // Note: Deleting user from Auth requires admin SDK or re-auth, but for simplicity, we'll just delete from DB
                // In production, use Firebase Admin SDK on backend

                setLoading(false);
                fetchEmployees();
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Employee has been deleted.',
                    background: '#1a1a2e',
                    color: '#fff'
                });
            } catch (error) {
                setLoading(false);
                console.error('Error deleting employee:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete employee.',
                    background: '#1a1a2e',
                    color: '#fff'
                });
            }
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateEmployee = async (e) => {
        e.preventDefault();
        console.log("Starting Employee Creation Process...");

        if (formData.password !== formData.confirmPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Passwords do not match!',
                background: '#1a1a2e',
                color: '#fff'
            });
            return;
        }

        if (formData.password.length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Weak Password',
                text: 'Password must be at least 6 characters.',
                background: '#1a1a2e',
                color: '#fff'
            });
            return;
        }

        setLoading(true);
        const appName = `SecondaryApp-${Date.now()}`;
        let secondaryApp = null;

        try {
            console.log("Initializing Secondary App:", appName);
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);

            console.log("Creating user in Firebase Auth...");
            // Timeout safety for Auth creation (increased to 60s for slow networks)
            const createPromise = createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 60000));

            const userCredential = await Promise.race([createPromise, timeoutPromise]);
            const user = userCredential.user;
            console.log("User created in Auth with UID:", user.uid);

            console.log("Writing to Firestore...");
            // Path: companies/{orgId}/employees/{uid}

            // Timeout safety for Firestore Write (increased to 60s)
            const writePromise = setDoc(doc(db, "companies", orgId, "employees", user.uid), {
                uid: user.uid,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                address: formData.address,
                role: 'employee',
                createdAt: serverTimestamp(),
            });
            const writeTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Write timed out")), 60000));

            await Promise.race([writePromise, writeTimeout]);
            console.log("Firestore write successful.");

            // Reset loading BEFORE showing success popup
            setLoading(false);
            setShowAddForm(false);

            // Success Popup
            console.log("Showing Success Popup...");
            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: `Employee ${formData.name} has been created successfully.`,
                background: '#1a1a2e',
                color: '#fff',
                confirmButtonColor: 'var(--color-primary)'
            });

            setFormData({
                name: '',
                phone: '',
                email: '',
                address: '',
                password: '',
                confirmPassword: ''
            });

        } catch (err) {
            console.error("Employee Creation Error:", err);

            // Reset loading state IMMEDIATELY on error
            setLoading(false);

            let errMsg = err.message;
            if (err.code === 'auth/email-already-in-use') errMsg = 'Email is already registered.';
            if (errMsg === 'Request timed out' || errMsg === 'Firestore Write timed out') {
                errMsg = 'The request timed out due to slow internet. The account may have been created successfully. Please check the employee list before retrying.';
            }
            // Check for client-side blocking (AdBlockers)
            if (err.message && (err.message.includes('BLOCKED_BY_CLIENT') || err.message.includes('Failed to fetch'))) {
                errMsg = 'Network request blocked. Please disable any AdBlockers or Privacy extensions and try again.';
            }

            await Swal.fire({
                icon: 'error',
                title: 'Registration Failed',
                text: errMsg,
                background: '#1a1a2e',
                color: '#fff'
            });

        } finally {
            console.log("Cleaning up...");
            // We use signOut instead of deleteApp to prevent erratic network behavior/termination errors 
            // observed with 'ERR_BLOCKED_BY_CLIENT' when deleting apps rapidly.
            if (secondaryApp) {
                try {
                    const secondaryAuth = getAuth(secondaryApp);
                    await signOut(secondaryAuth);
                    console.log("Secondary Auth Signed Out.");
                } catch (cleanupErr) {
                    console.error("Cleanup Error:", cleanupErr);
                }
            }
            // Ensure loading is false (redundant but safe)
            setLoading(false);
            console.log("Loading state reset.");
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();

        // Find assigned employee details
        const assignedEmp = employees.find(e => e.id === projectFormData.employeeId);
        if (!assignedEmp) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please select a valid employee.',
                background: '#1a1a2e',
                color: '#fff'
            });
            return;
        }

        if (projectFormData.clientPassword.length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Weak Password',
                text: 'Client password must be at least 6 characters.',
                background: '#1a1a2e',
                color: '#fff'
            });
            return;
        }

        setLoading(true);
        const appName = `SecondaryApp-Proj-${Date.now()}`;
        let secondaryApp = null;

        try {
            // 1. Create Client Auth User
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                projectFormData.clientEmail,
                projectFormData.clientPassword
            );
            const clientUser = userCredential.user;

            // 2. Create Project Document
            // Path: companies/{orgId}/projects/{projectId}
            const projectRef = doc(collection(db, "companies", orgId, "projects"));
            const projectData = {
                name: projectFormData.name,
                amount: projectFormData.amount, // Employee Payout
                clientAmount: projectFormData.clientAmount, // What admin collected
                clientEmail: projectFormData.clientEmail,
                clientUid: clientUser.uid,
                assignedEmployeeId: assignedEmp.id,
                assignedEmployeeName: assignedEmp.name,
                status: 'Active',
                createdAt: serverTimestamp()
            };

            await setDoc(projectRef, projectData);

            // 3. Create Client Document (for Login Lookup)
            // Path: companies/{orgId}/clients/{clientUid}
            await setDoc(doc(db, "companies", orgId, "clients", clientUser.uid), {
                uid: clientUser.uid,
                email: projectFormData.clientEmail,
                role: 'client',
                projectId: projectRef.id, // Link to project
                orgId: orgId
            });

            setLoading(false);
            setShowProjectForm(false);

            await Swal.fire({
                icon: 'success',
                title: 'Project Created',
                text: `Project assigned to ${assignedEmp.name}. Client account created.`,
                background: '#1a1a2e',
                color: '#fff',
                confirmButtonColor: 'var(--color-primary)'
            });

            setProjectFormData({
                name: '',
                employeeId: '',
                amount: '',
                clientAmount: '',
                clientEmail: '',
                clientPassword: ''
            });

            fetchProjects(); // Refresh list

        } catch (err) {
            console.error("Project Creation Error:", err);
            setLoading(false);

            let errMsg = err.message;
            if (err.code === 'auth/email-already-in-use') errMsg = 'Client email is already registered.';

            await Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: errMsg,
                background: '#1a1a2e',
                color: '#fff'
            });
        } finally {
            if (secondaryApp) {
                try {
                    await signOut(getAuth(secondaryApp));
                    // deleteApp(secondaryApp); // Optional, skipping to avoid known errors
                } catch (e) {
                    console.error("Cleanup error", e);
                }
            }
        }
    };

    // Stats Calculation
    const totalEmployees = employees.length;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const projectsThisMonth = projects.filter(p => {
        if (!p.createdAt) return false;
        const d = p.createdAt.toDate();
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const completedProjects = projects.filter(p => p.status === 'Completed').length;
    const cancelledProjects = projects.filter(p => p.status === 'Cancelled').length;

    const handleProjectAction = async (project, action) => {
        if (action === 'cancel') {
            const confirm = await Swal.fire({
                title: 'Cancel Project & Deactivate Client?',
                text: "This will mark the project as Cancelled in your history. It will PERMANENTLY DELETE the Client's login credentials, preventing them from accessing the dashboard.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, Cancel & Delete Login',
                background: '#1a1a2e',
                color: '#fff'
            });

            if (confirm.isConfirmed) {
                try {
                    // 1. Update Project Status (Keeps History/Stats)
                    await updateDoc(doc(db, "companies", orgId, "projects", project.id), {
                        status: 'Cancelled'
                    });

                    // 2. Permanently Delete Client Document (Removes Login Access)
                    if (project.clientUid) {
                        try {
                            await deleteDoc(doc(db, "companies", orgId, "clients", project.clientUid));
                            console.log("Client login document deleted.");
                        } catch (e) {
                            console.warn("Client doc already gone or error:", e);
                        }
                    }

                    await Swal.fire({
                        title: 'Cancelled',
                        text: 'Project history retained. Client login deleted.',
                        icon: 'success',
                        background: '#1a1a2e',
                        color: '#fff'
                    });

                    fetchProjects();
                } catch (error) {
                    console.error("Error cancelling project:", error);
                    Swal.fire('Error', 'Failed to cancel project.', 'error');
                }
            }
        } else if (action === 'complete') {
            // Fetch tasks to verify completion status
            const tasksRef = collection(db, "companies", orgId, "projects", project.id, "tasks");
            const tasksSnapshot = await getDocs(tasksRef);
            const tasks = tasksSnapshot.docs.map(t => t.data());
            const pendingTasks = tasks.filter(t => t.status !== 'Completed');

            if (pendingTasks.length > 0) {
                const confirm = await Swal.fire({
                    title: 'Pending Tasks Found!',
                    text: `There are ${pendingTasks.length} tasks not marked as Completed. Do you still want to complete the project?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#f59e0b',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, Complete Anyway',
                    cancelButtonText: 'Cancel',
                    background: '#1a1a2e',
                    color: '#fff'
                });

                if (!confirm.isConfirmed) return;
            }

            const confirm = await Swal.fire({
                title: 'Mark as Completed?',
                text: "This will mark the project as successfully completed. Tasks can no longer be updated.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, Complete it',
                background: '#1a1a2e',
                color: '#fff'
            });

            if (confirm.isConfirmed) {
                try {
                    await updateDoc(doc(db, "companies", orgId, "projects", project.id), {
                        status: 'Completed'
                    });
                    fetchProjects();
                    Swal.fire({
                        title: 'Completed!',
                        text: 'Project marked as done.',
                        icon: 'success',
                        background: '#1a1a2e',
                        color: '#fff'
                    });
                } catch (error) {
                    console.error("Error updating project:", error);
                    Swal.fire('Error', 'Failed to update status.', 'error');
                }
            }
        }
    };

    // --- Task Management Functions ---

    const fetchTasks = async (projectId) => {
        try {
            const querySnapshot = await getDocs(collection(db, "companies", orgId, "projects", projectId, "tasks"));
            const taskList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by date if needed
            setTasks(taskList);
        } catch (error) {
            console.error("Error fetching tasks:", error);
            Swal.fire('Error', 'Failed to load tasks.', 'error');
        }
    };

    const handleOpenTasks = (project) => {
        setSelectedProject(project);
        setTasks([]);
        fetchTasks(project.id);
        setShowTaskModal(true);
    };

    const handleSaveTask = async (e) => {
        e.preventDefault();
        if (!selectedProject) return;

        if (selectedProject.status === 'Completed') {
            Swal.fire('Restricted', 'Cannot edit tasks for a completed project.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const taskRef = collection(db, "companies", orgId, "projects", selectedProject.id, "tasks");

            if (editingTask) {
                // Update
                await updateDoc(doc(taskRef, editingTask.id), {
                    title: taskFormData.title,
                    date: taskFormData.date,
                    status: taskFormData.status
                });
            } else {
                // Create
                await setDoc(doc(taskRef), {
                    title: taskFormData.title,
                    date: taskFormData.date,
                    status: 'Not Started',
                    createdAt: serverTimestamp()
                });
            }

            setTaskFormData({ title: '', date: '', status: 'Not Started' });
            setEditingTask(null);
            fetchTasks(selectedProject.id);
            setLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                text: editingTask ? 'Task updated' : 'Task added'
            });
        } catch (error) {
            console.error("Error saving task:", error);
            setLoading(false);
            Swal.fire('Error', 'Failed to save task.', 'error');
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (selectedProject.status === 'Completed') {
            Swal.fire('Restricted', 'Cannot delete tasks for a completed project.', 'warning');
            return;
        }
        try {
            await deleteDoc(doc(db, "companies", orgId, "projects", selectedProject.id, "tasks", taskId));
            fetchTasks(selectedProject.id);
            Swal.fire({
                icon: 'success',
                title: 'Deleted',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                text: 'Task deleted'
            });
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    const handleOpenChat = (project) => {
        setSelectedChatProject(project);
        setShowChatModal(true);
    };

    const handleEditTaskClick = (task) => {
        setEditingTask(task);
        setTaskFormData({
            title: task.title,
            date: task.date,
            status: task.status
        });
    };

    const handleTaskStatusChange = async (task, newStatus) => {
        if (selectedProject.status === 'Completed') {
            Swal.fire('Restricted', 'Cannot update tasks for a completed project.', 'warning');
            return;
        }
        try {
            await updateDoc(doc(db, "companies", orgId, "projects", selectedProject.id, "tasks", task.id), {
                status: newStatus
            });
            fetchTasks(selectedProject.id);
        } catch (error) {
            console.error("Error updating task status:", error);
        }
    };

    return (
        <div className="admin-container" style={org.theme}>
            {/* Mobile Header */}
            <div className="mobile-header">
                <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)}>☰</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="logo-icon" style={{ fontSize: '1.2rem', minWidth: 'auto', height: 'auto' }}>🛡️</div>
                    <span className="mobile-header-title">Admin Panel</span>
                </div>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Mobile Drawer Overlay */}
            {mobileMenuOpen && <div className="drawer-overlay" onClick={() => setMobileMenuOpen(false)}></div>}

            {/* Expandable Sidebar */}
            <div className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-icon">🛡️</div>
                    <span className="sidebar-title">Admin Panel</span>
                    <button className="close-sidebar-btn" onClick={() => setMobileMenuOpen(false)}>×</button>
                </div>

                <nav className="nav-menu">
                    <button
                        onClick={() => setCurrentView('dashboard')}
                        className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                    >
                        <span className="nav-icon">📊</span>
                        <span className="nav-text">Dashboard</span>
                    </button>

                    <button
                        onClick={() => setCurrentView('employees')}
                        className={`nav-item ${currentView === 'employees' ? 'active' : ''}`}
                    >
                        <span className="nav-icon">👥</span>
                        <span className="nav-text">Employees</span>
                    </button>

                    <button
                        onClick={() => setCurrentView('projects')}
                        className={`nav-item ${currentView === 'projects' ? 'active' : ''}`}
                    >
                        <span className="nav-icon">📁</span>
                        <span className="nav-text">Projects</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button onClick={onLogout} className="nav-item logout-btn">
                        <span className="nav-icon">🚪</span>
                        <span className="nav-text">Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="main-content">
                {currentView === 'dashboard' && (
                    <div className="content-wrapper fade-in">
                        <header className="top-header" style={{ marginBottom: '2rem' }}>
                            <div>
                                <h1>Welcome, Admin</h1>
                                <p>Manage your organization efficiently.</p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                {/* Notification Bell */}
                                <div className="notification-container" style={{ position: 'relative' }}>
                                    <button
                                        className="btn-icon-bell"
                                        onClick={() => setShowNotifications(!showNotifications)}
                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', position: 'relative' }}
                                    >
                                        🔔
                                        {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
                                    </button>

                                    {showNotifications && (
                                        <div className="notification-dropdown fade-in-up">
                                            <div className="notif-header">
                                                <span>Notifications</span>
                                                {notifications.length > 0 && <button onClick={clearAllNotifications} className="btn-text">Clear All</button>}
                                            </div>
                                            <div className="notif-list">
                                                {notifications.length === 0 ? (
                                                    <div className="empty-notif">No new messages</div>
                                                ) : (
                                                    notifications.map(n => (
                                                        <div key={n.id} className="notif-item">
                                                            <div className="notif-content" onClick={() => {
                                                                const p = projects.find(proj => proj.id === n.projectId);
                                                                if (p) {
                                                                    handleOpenChat(p);
                                                                    setShowNotifications(false);
                                                                }
                                                            }}>
                                                                <strong>New message in {n.projectName}</strong>
                                                                <p className="notif-text"><strong>{n.sender}:</strong> {n.text}</p>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); clearNotification(n.id); }} className="btn-close-small">×</button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="org-badge">
                                    <span>{org.name}</span>
                                </div>
                            </div>
                        </header>

                        <div className="glass-card">
                            <div className="card-header">
                                <span className="card-icon-bg">🏠</span>
                                <h2>Dashboard Overview</h2>
                            </div>
                            <div className="dashboard-content">
                                <div className="stats-grid">
                                    <div className="stat-card" style={{ borderLeftColor: '#0ea5e9' }}>
                                        <div className="stat-header">
                                            <span className="stat-title">TOTAL EMPLOYEES</span>
                                            <span className="stat-icon-ref" style={{ color: '#0ea5e9' }}>👥</span>
                                        </div>
                                        <div className="stat-value">{totalEmployees}</div>
                                    </div>

                                    <div className="stat-card" style={{ borderLeftColor: '#f59e0b' }}>
                                        <div className="stat-header">
                                            <span className="stat-title">PROJECTS (MONTH)</span>
                                            <span className="stat-icon-ref" style={{ color: '#f59e0b' }}>📅</span>
                                        </div>
                                        <div className="stat-value">{projectsThisMonth}</div>
                                    </div>

                                    <div className="stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
                                        <div className="stat-header">
                                            <span className="stat-title">ACTIVE PROJECTS</span>
                                            <span className="stat-icon-ref" style={{ color: '#8b5cf6' }}>🚀</span>
                                        </div>
                                        <div className="stat-value">{activeProjects}</div>
                                    </div>

                                    <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
                                        <div className="stat-header">
                                            <span className="stat-title">COMPLETED</span>
                                            <span className="stat-icon-ref" style={{ color: '#10b981' }}>✅</span>
                                        </div>
                                        <div className="stat-value">{completedProjects}</div>
                                    </div>

                                    <div className="stat-card" style={{ borderLeftColor: '#ef4444' }}>
                                        <div className="stat-header">
                                            <span className="stat-title">CANCELLED</span>
                                            <span className="stat-icon-ref" style={{ color: '#ef4444' }}>🚫</span>
                                        </div>
                                        <div className="stat-value">{cancelledProjects}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'employees' && (
                    <div className="content-wrapper fade-in">
                        <div className="toolbar">
                            <h2>Employee Directory</h2>
                            <button onClick={() => setShowAddForm(!showAddForm)} className="btn-add-action">
                                {showAddForm ? 'Cancel' : (
                                    <>
                                        <span style={{ marginRight: '0.5rem', fontSize: '1.1rem' }}>+</span>
                                        Add Employee
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="glass-card no-padding">
                            {employees.length === 0 ? (
                                <div className="empty-state">
                                    <span style={{ fontSize: '3rem' }}>📂</span>
                                    <p>No employees found. Start by adding one!</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="modern-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Phone</th>
                                                <th>Address</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employees.map(employee => (
                                                <tr key={employee.id}>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="avatar-placeholder">{employee.name.charAt(0)}</div>
                                                            <span className="user-name">{employee.name}</span>
                                                        </div>
                                                    </td>
                                                    <td>{employee.email}</td>
                                                    <td>{employee.phone}</td>
                                                    <td className="truncate-cell" title={employee.address}>{employee.address}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button onClick={() => handleEditEmployee(employee)} className="btn-icon" title="Edit">
                                                            ✏️
                                                        </button>
                                                        <button onClick={() => handleDeleteEmployee(employee)} className="btn-icon delete" title="Delete">
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {editingEmployee && (
                            <div className="modal-overlay">
                                <div className="glass-card modal-content fade-in-up">
                                    <div className="card-header">
                                        <h2>Edit Employee</h2>
                                        <button onClick={() => setEditingEmployee(null)} className="btn-close">×</button>
                                    </div>
                                    <form onSubmit={handleUpdateEmployee} className="grid-form">
                                        <div className="form-group span-2">
                                            <label>Full Name</label>
                                            <input name="name" className="modern-input" required value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Email</label>
                                            <input name="email" type="email" className="modern-input" required value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Phone</label>
                                            <input name="phone" type="tel" className="modern-input" required value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} />
                                        </div>
                                        <div className="form-group span-2">
                                            <label>Address</label>
                                            <textarea name="address" className="modern-input" rows="3" required value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} />
                                        </div>
                                        <div className="form-actions span-2">
                                            <button type="submit" className="btn-modern-primary" disabled={loading}>
                                                {loading ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {showAddForm && (
                            <div className="modal-overlay">
                                <div className="glass-card modal-content fade-in-up" style={{ maxWidth: '800px' }}>
                                    <div className="card-header" style={{ justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className="card-icon-bg">👤</span>
                                            <h2 style={{ margin: 0 }}>Add New Employee</h2>
                                        </div>
                                        <button onClick={() => setShowAddForm(false)} className="btn-close">×</button>
                                    </div>
                                    <form onSubmit={handleCreateEmployee} className="grid-form">
                                        <div className="form-group span-2">
                                            <label>Full Name</label>
                                            <input
                                                name="name"
                                                className="modern-input"
                                                placeholder="e.g. John Doe"
                                                required
                                                value={formData.name}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Email Address</label>
                                            <input
                                                name="email"
                                                type="email"
                                                className="modern-input"
                                                placeholder="user@company.com"
                                                required
                                                value={formData.email}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Phone Number</label>
                                            <input
                                                name="phone"
                                                type="tel"
                                                className="modern-input"
                                                placeholder="+1 (555) 000-0000"
                                                required
                                                value={formData.phone}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group span-2">
                                            <label>Address</label>
                                            <textarea
                                                name="address"
                                                className="modern-input"
                                                placeholder="123 Business Rd, Tech City"
                                                rows="2"
                                                required
                                                value={formData.address}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Password</label>
                                            <input
                                                name="password"
                                                type="password"
                                                className="modern-input"
                                                placeholder="••••••••"
                                                required
                                                value={formData.password}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Confirm Password</label>
                                            <input
                                                name="confirmPassword"
                                                type="password"
                                                className="modern-input"
                                                placeholder="••••••••"
                                                required
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-actions span-2">
                                            <button type="submit" className="btn-modern-primary" disabled={loading}>
                                                {loading ? (
                                                    <>
                                                        <div className="spinner-small"></div>
                                                        Creating Account...
                                                    </>
                                                ) : (
                                                    'Create Account'
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentView === 'projects' && (
                    <div className="content-wrapper fade-in">
                        <div className="toolbar" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>Project Management</h2>
                            <button
                                onClick={() => setShowProjectForm(!showProjectForm)}
                                className="btn-primary-glow"
                            >
                                {showProjectForm ? 'Cancel' : '+ ADD NEW PROJECT'}
                            </button>
                        </div>

                        <div className="glass-card no-padding">
                            {projects.length === 0 ? (
                                <div className="empty-state">
                                    <span style={{ fontSize: '3rem' }}>📁</span>
                                    <p>No projects found. Create your first project!</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="modern-table">
                                        <thead>
                                            <tr>
                                                <th>Project Name</th>
                                                <th>Assigned To</th>
                                                <th>Client</th>
                                                <th>Budget</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {projects.map(project => (
                                                <tr key={project.id}>
                                                    <td style={{ fontWeight: '600', color: 'white' }}>{project.name}</td>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="avatar-placeholder">{project.assignedEmployeeName ? project.assignedEmployeeName.charAt(0) : '?'}</div>
                                                            <span>{project.assignedEmployeeName}</span>
                                                        </div>
                                                    </td>
                                                    <td>{project.clientEmail}</td>
                                                    <td>{project.clientEmail}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>
                                                        <div style={{ fontSize: '0.85rem', color: '#10b981' }} title="Client Amount (Income)">+ ₹{project.clientAmount || '0'}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#f59e0b' }} title="Employee Payout (Expense)">- ₹{project.amount}</div>
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '50px',
                                                            background: project.status === 'Cancelled' ? 'rgba(239, 68, 68, 0.2)' : (project.status === 'Completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                                                            color: project.status === 'Cancelled' ? '#ef4444' : (project.status === 'Completed' ? '#10b981' : '#60a5fa'),
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600'
                                                        }}>
                                                            {project.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {project.status === 'Active' && (
                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                                <button onClick={() => handleOpenTasks(project)} title="Manage Tasks" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                                    📋
                                                                </button>
                                                                <button onClick={() => handleOpenChat(project)} title="Project Chat" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', color: '#8b5cf6', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                                    💬
                                                                </button>
                                                                <button onClick={() => handleProjectAction(project, 'complete')} title="Mark Done" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                                    ✅
                                                                </button>
                                                                <button onClick={() => handleProjectAction(project, 'cancel')} title="Cancel Project" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                                    🚫
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {showProjectForm && (
                            <div className="modal-overlay">
                                <div className="glass-card modal-content fade-in-up" style={{ maxWidth: '700px' }}>
                                    <div className="card-header" style={{ justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className="card-icon-bg">📁</span>
                                            <h2 style={{ margin: 0 }}>Create New Project</h2>
                                        </div>
                                        <button onClick={() => setShowProjectForm(false)} className="btn-close">×</button>
                                    </div>
                                    <form onSubmit={handleCreateProject} className="grid-form">
                                        <div className="form-group span-2">
                                            <label>Project Name</label>
                                            <input
                                                className="modern-input"
                                                placeholder="e.g. Website Overhaul"
                                                required
                                                value={projectFormData.name}
                                                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Assign Employee</label>
                                            <select
                                                className="modern-input"
                                                required
                                                value={projectFormData.employeeId}
                                                onChange={(e) => setProjectFormData({ ...projectFormData, employeeId: e.target.value })}
                                            >
                                                <option value="">Select Employee</option>
                                                {employees.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group span-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label>Client Amount (Collected) <span style={{ fontSize: '0.7rem', color: '#10b981' }}>(Admin Only)</span></label>
                                                <input
                                                    type="number"
                                                    className="modern-input"
                                                    placeholder="e.g. 10000"
                                                    required
                                                    value={projectFormData.clientAmount}
                                                    onChange={(e) => setProjectFormData({ ...projectFormData, clientAmount: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label>Employee Payout <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>(Visible to Emp)</span></label>
                                                <input
                                                    type="number"
                                                    className="modern-input"
                                                    placeholder="e.g. 5000"
                                                    required
                                                    value={projectFormData.amount}
                                                    onChange={(e) => setProjectFormData({ ...projectFormData, amount: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Client Email (Login ID)</label>
                                            <input
                                                type="email"
                                                className="modern-input"
                                                placeholder="client@client.com"
                                                required
                                                value={projectFormData.clientEmail}
                                                onChange={(e) => setProjectFormData({ ...projectFormData, clientEmail: e.target.value })}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Client Password</label>
                                            <input
                                                type="text"
                                                className="modern-input"
                                                placeholder="Set login password"
                                                required
                                                minLength="6"
                                                value={projectFormData.clientPassword}
                                                onChange={(e) => setProjectFormData({ ...projectFormData, clientPassword: e.target.value })}
                                            />
                                        </div>

                                        <div className="form-actions span-2">
                                            <button type="submit" className="btn-modern-primary" disabled={loading}>
                                                {loading ? (
                                                    <>
                                                        <div className="spinner-small"></div>
                                                        Creating Project...
                                                    </>
                                                ) : (
                                                    'Create Project & Client Account'
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Task Management Modal */}
            {showTaskModal && selectedProject && (
                <div className="modal-overlay">
                    <div className="glass-card modal-content fade-in-up" style={{ maxWidth: '800px' }}>
                        <div className="card-header" style={{ justifyContent: 'space-between' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Tasks: {selectedProject.name}</h2>
                                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Assign and manage tasks for {selectedProject.assignedEmployeeName}</p>
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="btn-close">×</button>
                        </div>

                        <div className="modal-body-scroll" style={{ padding: '0 2rem 2rem' }}>
                            {/* Task Form */}
                            <form onSubmit={handleSaveTask} className="task-form" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                                    <div className="form-group">
                                        <label>Task Description</label>
                                        <input
                                            className="modern-input"
                                            placeholder="e.g. Design Homepage Wireframe"
                                            required
                                            value={taskFormData.title}
                                            onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Target Date</label>
                                        <input
                                            type="date"
                                            className="modern-input"
                                            required
                                            value={taskFormData.date}
                                            onChange={(e) => setTaskFormData({ ...taskFormData, date: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="btn-modern-primary" style={{ height: '52px' }}>
                                        {editingTask ? 'Update' : 'Add Task'}
                                    </button>
                                </div>
                                {editingTask && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingTask(null); setTaskFormData({ title: '', date: '', status: 'Pending' }); }}
                                        style={{ color: '#94a3b8', background: 'none', border: 'none', marginTop: '0.5rem', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </form>

                            {/* Tasks List */}
                            <div className="tasks-list">
                                {tasks.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No tasks added yet.
                                    </div>
                                ) : (
                                    <table className="modern-table">
                                        <thead>
                                            <tr>
                                                <th>Status</th>
                                                <th>Task</th>
                                                <th>Date</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tasks.map(task => (
                                                <tr key={task.id} style={{ opacity: task.status === 'Completed' ? 0.6 : 1 }}>
                                                    <td>
                                                        <select
                                                            value={task.status}
                                                            onChange={(e) => handleTaskStatusChange(task, e.target.value)}
                                                            style={{
                                                                background: task.status === 'Completed' ? 'rgba(16, 185, 129, 0.2)' : (task.status === 'In Process' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.1)'),
                                                                color: task.status === 'Completed' ? '#10b981' : (task.status === 'In Process' ? '#f59e0b' : '#94a3b8'),
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                borderRadius: '8px',
                                                                padding: '0.25rem 0.5rem',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '600',
                                                                outline: 'none',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <option value="Not Started" style={{ background: '#1e293b', color: '#94a3b8' }}>Not Started</option>
                                                            <option value="In Process" style={{ background: '#1e293b', color: '#f59e0b' }}>In Process</option>
                                                            <option value="Completed" style={{ background: '#1e293b', color: '#10b981' }}>Completed</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
                                                        {task.title}
                                                    </td>
                                                    <td>{task.date}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button onClick={() => handleEditTaskClick(task)} className="btn-icon" title="Edit">✏️</button>
                                                        <button onClick={() => handleDeleteTask(task.id)} className="btn-icon delete" title="Delete">🗑️</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}



            <style>{`
                .btn-icon-bell .badge {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    padding: 0.25rem 0.5rem;
                    font-size: 0.7rem;
                    font-weight: bold;
                }
                .notification-dropdown {
                    position: absolute;
                    top: 50px;
                    left: 0;
                    width: 320px;
                    background: #1e293b;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    z-index: 1000;
                    overflow: hidden;
                }
                .notif-header {
                    padding: 0.75rem 1rem;
                    background: rgba(255,255,255,0.05);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 600;
                    font-size: 0.9rem;
                }
                .notif-list {
                    max-height: 300px;
                    overflow-y: auto;
                }
                .notif-item {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.5rem;
                    transition: background 0.2s;
                }
                .notif-item:hover {
                    background: rgba(255,255,255,0.03);
                }
                .notif-content {
                    cursor: pointer;
                    flex: 1;
                }
                .notif-content strong { color: #fff; font-size: 0.85rem; display: block; margin-bottom: 0.2rem; }
                .notif-content em { color: #94a3b8; font-size: 0.8rem; font-style: normal; margin-left: 0.25rem; }
                .notif-text {
                    margin: 0.25rem 0 0 0;
                    color: #cbd5e1;
                    font-size: 0.8rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .btn-text {
                    background: none;
                    border: none;
                    color: #6366f1;
                    font-size: 0.75rem;
                    cursor: pointer;
                }
                .btn-close-small {
                    background: none;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    font-size: 1.2rem;
                    line-height: 0.5;
                }
                .empty-notif {
                    padding: 2rem;
                    text-align: center;
                    color: #64748b;
                    font-size: 0.9rem;
                }
            `}</style>

            {/* Chat Modal */}
            {
                showChatModal && selectedChatProject && (
                    <div className="modal-overlay" onClick={() => setShowChatModal(false)}>
                        <div className="modal-content chat-modal" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', height: '85vh' }}>
                            <ProjectChat
                                projectId={selectedChatProject.id}
                                orgId={orgId}
                                user={{ uid: user.uid, displayName: 'Admin', role: 'Admin' }}
                                onClose={() => setShowChatModal(false)}
                            />
                        </div>
                    </div>
                )
            }

            <style>{`
                /* Layout */
                .admin-container {
                    display: flex;
                    height: 100vh;
                    width: 100vw;
                    background: #0f172a; /* Fallback */
                    background: linear-gradient(135deg, #0f172a 0%, #1e1e32 100%);
                    font-family: 'Inter', system-ui, sans-serif;
                    overflow: hidden;
                    color: white;
                }

                @media (max-width: 768px) {
                    .admin-container {
                        flex-direction: column;
                    }
                }

                /* Sidebar */
                .sidebar {
                    width: 80px;
                    background: rgba(20, 20, 35, 0.6);
                    backdrop-filter: blur(20px);
                    border-right: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    flex-direction: column;
                    padding: 1.5rem 0.75rem;
                    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 50;
                    flex-shrink: 0;
                    position: relative;
                }

                .sidebar:hover {
                    width: 280px;
                    background: rgba(20, 20, 35, 0.95);
                }

                /* Mobile Header & Drawer CSS */
                .mobile-header {
                    display: none;
                    background: #1e293b;
                    padding: 1rem;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    position: sticky;
                    top: 0;
                    z-index: 900;
                }
                .hamburger-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                }
                .mobile-header-title {
                    font-weight: 700;
                    font-size: 1.1rem;
                    color: white;
                }
                .drawer-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.5);
                    z-index: 998;
                    backdrop-filter: blur(2px);
                }
                .close-sidebar-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    margin-left: auto;
                    cursor: pointer;
                }

                @media (max-width: 768px) {
                    .mobile-header {
                        display: flex;
                    }

                    .sidebar {
                        position: fixed;
                        top: 0;
                        left: -100%;
                        height: 100vh;
                        width: 280px;
                        background: #1e293b;
                        z-index: 999;
                        transition: left 0.3s ease;
                        border-right: 1px solid rgba(255,255,255,0.1);
                        padding: 0;
                        padding-top: 1rem;
                    }
                    .sidebar.open {
                        left: 0;
                    }
                    
                    .sidebar:hover {
                        width: 280px;
                    }

                    .sidebar-header {
                        display: flex; /* Show header in drawer */
                        padding: 0 1rem; 
                    }
                    .close-sidebar-btn {
                        display: block;
                    }
                    .sidebar-footer {
                         display: block;
                    }

                    /* Reset Nav Items for Drawer */
                    .nav-item {
                        flex-direction: row;
                        justify-content: flex-start;
                        height: auto;
                        padding: 1rem 1.5rem;
                    }
                    .nav-icon {
                        margin-right: 0;
                        margin-bottom: 0;
                        min-width: 24px;
                    }
                    .nav-text {
                        display: block !important;
                        opacity: 1 !important;
                        transform: none !important;
                        font-size: 1rem;
                        font-weight: 500;
                        margin-left: 1rem;
                    }
                    .nav-item.active {
                        border: none;
                        background: rgba(255, 255, 255, 0.1) !important;
                        color: white !important;
                    }
                }

                /* Header */
                .sidebar-header {
                    display: flex;
                    align-items: center;
                    padding: 0 0.75rem;
                    margin-bottom: 3rem;
                    height: 40px;
                    overflow: hidden;
                    white-space: nowrap;
                }

                .logo-icon {
                    min-width: 40px;
                    height: 40px;
                    font-size: 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sidebar-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--color-primary);
                    margin-left: 1rem;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .sidebar:hover .sidebar-title {
                    opacity: 1;
                    transition-delay: 0.1s;
                }

                /* Nav Items */
                .nav-menu {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    flex: 1;
                    padding: 1rem 0;
                }
                
                @media (max-width: 768px) {
                    .nav-menu {
                        flex-direction: column; /* Vertical stack for drawer */
                        width: 100%;
                        justify-content: flex-start;
                        padding: 1rem 0;
                        gap: 0.5rem;
                    }
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    padding: 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                    width: 100%;
                    overflow: hidden;
                    white-space: nowrap;
                }

                @media (max-width: 768px) {
                    /* Restore standard list view for nav items in drawer */
                }

                .nav-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                }

                .nav-item.active {
                    background: rgba(99, 102, 241, 0.15);
                    color: var(--color-primary);
                }

                .nav-icon {
                    min-width: 24px;
                    font-size: 1.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nav-text {
                    margin-left: 1rem;
                    font-size: 1rem;
                    font-weight: 500;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .sidebar:hover .nav-text {
                    opacity: 1;
                    transition-delay: 0.1s;
                }

                .sidebar-footer {
                    margin-top: auto;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    padding-top: 1rem;
                }

                .logout-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                /* Main Content */
                .main-content {
                    flex: 1;
                    padding: 2.5rem;
                    overflow-y: auto;
                    position: relative;
                }

                @media (max-width: 768px) {
                    .main-content {
                        padding: 1rem;
                        padding-bottom: 80px; /* Space for bottom nav */
                    }
                    .page-title {
                         font-size: 1.8rem;
                    }
                    .header-pro {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                        margin-bottom: 1.5rem;
                    }
                    .stats-grid {
                        grid-template-columns: 1fr 1fr; /* Two columns */
                        gap: 1rem;
                    }
                    .stat-value {
                        font-size: 1.5rem;
                    }
                    .glass-card {
                        padding: 1.5rem;
                    }
                    /* Force table horizontal scroll */
                    .table-responsive {
                        display: block;
                        width: 100%;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                    }
                }

                .header-pro {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 2.5rem;
                }

                .page-title {
                    font-size: 2.5rem;
                    font-weight: 700;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    margin: 0;
                }

                .page-subtitle {
                    color: #94a3b8;
                    margin-top: 0.5rem;
                    font-size: 1.1rem;
                }

                .org-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(255,255,255,0.05);
                    padding: 0.5rem 1rem;
                    border-radius: 50px;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .org-logo-small {
                    width: 24px;
                    height: 24px;
                    object-fit: contain;
                }

                /* Cards & Forms */
                .glass-card {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    padding: 2.5rem;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1.5rem;
                    margin-top: 2rem;
                    width: 100%;
                }

                .glass-card.no-padding {
                    padding: 0;
                    overflow: hidden;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                
                .card-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                }

                .card-icon-bg {
                    width: 48px;
                    height: 48px;
                    background: rgba(99, 102, 241, 0.1);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    color: var(--color-primary);
                }

                .grid-form {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-group.span-2 {
                    grid-column: span 2;
                }

                .form-group label {
                    font-size: 0.9rem;
                    color: #94a3b8;
                    font-weight: 500;
                }

                .form-actions {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    margin-top: 1rem;
                }

                .modern-input {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 1rem;
                    border-radius: 10px;
                    font-size: 1rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    font-family: inherit;
                }

                .modern-input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }

                .btn-modern-primary {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 0.75rem;
                }

                .btn-modern-primary:hover {
                    background: var(--color-secondary);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
                }

                /* Tables */
                .modern-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .modern-table th {
                    text-align: left;
                    padding: 1.25rem 2rem;
                    color: #94a3b8;
                    font-weight: 500;
                    font-size: 0.9rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .modern-table td {
                    padding: 1.25rem 2rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    vertical-align: middle;
                }

                .modern-table tr:last-child td {
                    border-bottom: none;
                }

                .modern-table tr:hover {
                    background: rgba(255,255,255,0.02);
                }

                .user-cell {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .avatar-placeholder {
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: white;
                }

                .user-name {
                    font-weight: 600;
                    color: white;
                }

                .btn-icon {
                    background: transparent;
                    border: none;
                    font-size: 1.1rem;
                    padding: 0.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                    margin-left: 0.5rem;
                }

                .btn-icon:hover {
                    background: rgba(255,255,255,0.1);
                }
                
                .btn-icon.delete:hover {
                    background: rgba(239, 68, 68, 0.2);
                }

                /* Utils */
                .spinner-small {
                    width: 1rem;
                    height: 1rem;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s infinite linear;
                }
                
                .toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                
                .btn-modern-secondary {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-modern-secondary:hover {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                    background: rgba(99, 102, 241, 0.1);
                }

                .btn-add-action {
                    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
                    border: none;
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 4px 15px var(--color-primary-glow);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .btn-add-action:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px var(--color-primary-glow);
                    filter: brightness(1.1);
                }
                
                .btn-add-action:active {
                    transform: translateY(0);
                }
                
                .truncate-cell {
                    max-width: 200px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 999;
                    padding: 2rem;
                    box-sizing: border-box;
                }
                
                .modal-content {
                    width: 100%;
                    max-width: 700px;
                    background: #1e293b;
                    border: 1px solid rgba(255,255,255,0.1);
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    border-radius: 20px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .modal-content form {
                    overflow-y: auto;
                    padding: 2rem;
                    /* Custom scrollbar for modal */
                    scrollbar-width: thin;
                    scrollbar-color: var(--color-primary) rgba(255, 255, 255, 0.05);
                }
                .stat-card {
                    background: #1e293b;
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 5px solid transparent;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 140px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transition: transform 0.2s;
                }
                
                .stat-card:hover {
                    transform: translateY(-5px);
                }

                .stat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .stat-title {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #94a3b8;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }

                .stat-icon-ref {
                    font-size: 1.5rem;
                    opacity: 0.8;
                }

                .stat-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: white;
                    line-height: 1;
                }

                .modal-content > .card-header {
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    margin-bottom: 0;
                    flex-shrink: 0;
                    background: rgba(30, 41, 59, 0.5);
                    border-radius: 20px 20px 0 0;
                }
                
                .btn-primary-glow {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    box-shadow: 0 4px 14px 0 var(--color-primary-glow);
                    transition: all 0.2s ease;
                    text-transform: uppercase;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .btn-primary-glow:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px var(--color-primary-glow);
                    filter: brightness(1.1);
                }

                .btn-close {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    line-height: 1;
                }
                
                .btn-close:hover {
                    background: #ef4444;
                    transform: rotate(90deg);
                }

                @keyframes modalPop {
                    0% {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                @media (min-width: 1024px) {
                    .modal-content.chat-modal {
                        max-width: 1000px !important;
                        height: 90vh !important;
                    }
                }
                
                .modal-content.chat-modal {
                    max-width: 600px;
                    width: 95%;
                }
            `}</style>
        </div >
    );
};
export default AdminDashboard;
