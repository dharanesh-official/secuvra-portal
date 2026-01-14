import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'; // Removed duplicate import
import ProjectChat from './ProjectChat';

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [tasksMap, setTasksMap] = useState({}); // { projectId: [tasks] }
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('dashboard'); // 'dashboard' | 'projects'
    const [stats, setStats] = useState({ total: 0, completed: 0, assigned: 0, cancelled: 0 });
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedChatProject, setSelectedChatProject] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [orgId, setOrgId] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                // We need to find which org this employee belongs to.
                // Since we don't have orgId in URL for dashboard usually, we might store it in local storage during login 
                // OR we have to query all companies to find the user (inefficient) 
                // OR we can rely on the fact that we came from /login/:orgId 
                // For now, let's assume we pass orgId via state or local storage, 
                // BUT better yet, let's fetch the employee record to find their orgId if we stored it, 
                // OR we just use the localStorage if valid.

                const storedOrgId = localStorage.getItem('currentOrgId');

                if (storedOrgId) {
                    await fetchEmployeeData(currentUser.uid, storedOrgId);
                } else {
                    // Fallback or error
                    navigate('/');
                }
            } else {
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user || !orgId) return;

        const projectsRef = collection(db, 'companies', orgId, 'projects');
        const q = query(projectsRef, where('assignedEmployeeId', '==', user.uid));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const projList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setProjects(projList);
            checkNotifications(projList);

            // Calculate Stats
            const total = projList.length;
            const completed = projList.filter(p => p.status === 'Completed').length;
            const cancelled = projList.filter(p => p.status === 'Cancelled').length;
            const assigned = total - completed - cancelled;
            setStats({ total, completed, assigned, cancelled });

            // Fetch Tasks (Debounced or just overwrite for now to keep it simple and correct)
            // Note: This matches original logic which fetched tasks on every load. 
            // Here it fetches on every project update.
            const tasksData = {};
            for (const proj of projList) {
                const tasksRef = collection(db, 'companies', orgId, 'projects', proj.id, 'tasks');
                const tasksSnap = await getDocs(tasksRef);
                tasksData[proj.id] = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            setTasksMap(tasksData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, orgId]);

    const checkNotifications = (projList) => {
        const newNotifs = [];
        const clearedNotifs = JSON.parse(localStorage.getItem(`cleared_notifs_emp_${orgId}`) || '[]');

        projList.forEach(p => {
            if (p.lastMessage && p.lastMessage.senderId !== user.uid) {
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
        const cleared = JSON.parse(localStorage.getItem(`cleared_notifs_emp_${orgId}`) || '[]');
        cleared.push(id);
        localStorage.setItem(`cleared_notifs_emp_${orgId}`, JSON.stringify(cleared));
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const clearAllNotifications = () => {
        const cleared = JSON.parse(localStorage.getItem(`cleared_notifs_emp_${orgId}`) || '[]');
        const ids = notifications.map(n => n.id);
        localStorage.setItem(`cleared_notifs_emp_${orgId}`, JSON.stringify([...cleared, ...ids]));
        setNotifications([]);
    };

    const fetchEmployeeData = async (uid, oid) => {
        // This is now handled by the effect, we just set OrgId to trigger it
        setOrgId(oid);
    };

    const handleTaskStatusChange = async (projectId, task, newStatus) => {
        const storedOrgId = localStorage.getItem('currentOrgId');
        if (!storedOrgId) return;

        try {
            // Update UI optimistically
            setTasksMap(prev => ({
                ...prev,
                [projectId]: prev[projectId].map(t =>
                    t.id === task.id ? { ...t, status: newStatus } : t
                )
            }));

            // Update Firebase
            await updateDoc(doc(db, 'companies', storedOrgId, 'projects', projectId, 'tasks', task.id), {
                status: newStatus
            });
        } catch (error) {
            console.error("Error updating task:", error);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('currentOrgId');
        navigate('/');
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="dashboard-container">

            {/* Mobile Header */}
            <div className="mobile-header">
                <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)}>☰</button>
                <span className="mobile-header-title">Employee Portal</span>
                <div style={{ width: '40px' }}></div> {/* Spacer for balance */}
            </div>

            {/* Mobile Drawer Overlay */}
            {mobileMenuOpen && <div className="drawer-overlay" onClick={() => setMobileMenuOpen(false)}></div>}

            {/* Sidebar */}
            <div className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-icon">🏢</div>
                    <span className="sidebar-title">Employee Portal</span>
                    {/* Close button for mobile */}
                    <button className="close-sidebar-btn" onClick={() => setMobileMenuOpen(false)}>×</button>
                </div>

                <nav className="nav-menu">
                    <button
                        className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setView('dashboard')}
                    >
                        <span className="nav-icon">📊</span>
                        <span className="nav-text">Dashboard</span>
                    </button>
                    <button
                        className={`nav-item ${view === 'projects' ? 'active' : ''}`}
                        onClick={() => setView('projects')}
                    >
                        <span className="nav-icon">📁</span>
                        <span className="nav-text">My Projects</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="nav-item logout-btn">
                        <span className="nav-icon">➡️</span>
                        <span className="nav-text">Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                <div className="welcome-banner fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>Welcome Back, {user?.displayName || 'Employee'}</h1>
                        <p>{view === 'dashboard' ? 'Here is your performance overview.' : 'Here are your assigned projects.'}</p>
                    </div>
                    {/* Notification Bell */}
                    <div className="notification-container" style={{ position: 'relative', marginRight: '2rem' }}>
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
                                                    if (p) { setSelectedChatProject(p); setShowChatModal(true); setShowNotifications(false); }
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
                </div>

                {view === 'dashboard' ? (
                    <div className="stats-grid fade-in-up">
                        <div className="stat-card total">
                            <div className="stat-icon">📑</div>
                            <div className="stat-info">
                                <h3>Total Projects</h3>
                                <div className="stat-value">{stats.total}</div>
                            </div>
                        </div>
                        <div className="stat-card assigned">
                            <div className="stat-icon">⏳</div>
                            <div className="stat-info">
                                <h3>Assigned (Active)</h3>
                                <div className="stat-value">{stats.assigned}</div>
                            </div>
                        </div>
                        <div className="stat-card completed">
                            <div className="stat-icon">✅</div>
                            <div className="stat-info">
                                <h3>Completed</h3>
                                <div className="stat-value">{stats.completed}</div>
                            </div>
                        </div>
                        <div className="stat-card cancelled">
                            <div className="stat-icon">🚫</div>
                            <div className="stat-info">
                                <h3>Cancelled</h3>
                                <div className="stat-value">{stats.cancelled}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="projects-grid fade-in-up">
                        {projects.length === 0 ? (
                            <div className="empty-state">No projects assigned yet.</div>
                        ) : (
                            projects.map(project => (
                                <div key={project.id} className="project-card">
                                    <div className="card-header">
                                        <h3>{project.name}</h3>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedChatProject(project); setShowChatModal(true); }}
                                                className="btn-icon-chat"
                                                title="Project Chat"
                                            >
                                                💬
                                            </button>
                                            <span className={`status-badge ${project.status.toLowerCase()}`}>{project.status}</span>
                                        </div>
                                    </div>
                                    <div className="card-body">

                                        <div className="info-row">
                                            <label>Budget:</label>
                                            <span>₹{project.amount}</span>
                                        </div>
                                        <div className="info-row">
                                            <label>Assigned Date:</label>
                                            <span>{project.createdAt?.toDate().toLocaleDateString()}</span>
                                        </div>

                                        {/* Tasks Section */}
                                        <div className="tasks-section" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#94a3b8' }}>Assigned Tasks</h4>
                                            <div className="tasks-list-mini">
                                                {(tasksMap[project.id] && tasksMap[project.id].length > 0) ? (
                                                    tasksMap[project.id].map(task => (
                                                        <div key={task.id} className="task-item-mini">
                                                            <select
                                                                value={task.status}
                                                                onChange={(e) => handleTaskStatusChange(project.id, task, e.target.value)}
                                                                className={`status-select ${task.status === 'Completed' ? 'completed' : (task.status === 'In Process' ? 'in-process' : '')}`}
                                                                onClick={(e) => e.stopPropagation()} // Prevent card click
                                                            >
                                                                <option value="Not Started">Not Started</option>
                                                                <option value="In Process">In Process</option>
                                                                <option value="Completed">Completed</option>
                                                            </select>
                                                            <span className={task.status === 'Completed' ? 'done-text' : ''}>
                                                                {task.title}
                                                            </span>
                                                            <span className="task-date">{task.date}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>No tasks assigned.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Chat Modal */}
            {showChatModal && selectedChatProject && (
                <div className="modal-overlay" onClick={() => setShowChatModal(false)}>
                    <div className="modal-content chat-modal" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', height: '80vh', maxWidth: '600px' }}>
                        <ProjectChat
                            projectId={selectedChatProject.id}
                            // Ensure we have correct orgId. If fetched in fetchEmployeeData, we might need to store it in state or use localStorage
                            orgId={localStorage.getItem('currentOrgId')}
                            user={{ uid: user.uid, displayName: user.displayName || 'Employee', role: 'Employee' }}
                            onClose={() => setShowChatModal(false)}
                        />
                    </div>
                </div>
            )}

            <style>{`
                .dashboard-container {
                    display: flex;
                    min-height: 100vh;
                    background: linear-gradient(135deg, #0f172a 0%, #1e1e32 100%);
                    color: white;
                    font-family: 'Inter', sans-serif;
                }

                @media (max-width: 768px) {
                    .dashboard-container {
                        flex-direction: column;
                    }
                }

                /* Sidebar Styles (Matching AdminDashboard) */
                .sidebar {
                    width: 80px;
                    background: rgba(30, 41, 59, 0.7);
                    backdrop-filter: blur(12px);
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    flex-direction: column;
                    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 50;
                    overflow: hidden;
                    white-space: nowrap;
                }

                .sidebar:hover {
                    width: 260px;
                }

                /* Mobile Header Styles */
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
                }
                .drawer-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.5);
                    z-index: 998;
                    backdrop-filter: blur(2px);
                }
                .close-sidebar-btn {
                    display: none; /* Hidden on desktop */
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
                        left: -100%; /* Hidden by default */
                        height: 100vh;
                        width: 280px; /* Full drawer width */
                        background: #1e293b;
                        z-index: 999;
                        transition: left 0.3s ease;
                        border-right: 1px solid rgba(255,255,255,0.1);
                    }
                    .sidebar.open {
                        left: 0; /* Slide in */
                    }
                    
                    .sidebar:hover {
                        width: 280px; /* Reset hover effect */
                    }

                    .sidebar-header {
                        display: flex; /* Show header in drawer */
                    }
                    .close-sidebar-btn {
                        display: block; /* Show close button in drawer */
                    }
                    .sidebar-footer {
                         display: block; /* Show footer */
                    }
                    
                    /* Reset nav item styles from previous bottom-bar iteration */
                    .nav-item {
                        flex-direction: row;
                        justify-content: flex-start;
                        border-right: none;
                        padding: 1rem 1.5rem;
                    }
                    .nav-icon {
                        margin-right: 1rem;
                        margin-bottom: 0;
                    }
                    .nav-text {
                        display: block;
                        opacity: 1;
                        transform: none;
                    }
                    .nav-item.active {
                         border-right: 3px solid var(--color-primary, #6366f1);
                         border-top: none;
                    }
                }

                .sidebar-header {
                    height: 80px;
                    display: flex;
                    align-items: center;
                    padding: 0 1.5rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .logo-icon {
                    min-width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    margin-right: 1rem;
                }

                .sidebar-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    opacity: 0;
                    transform: translateX(-10px);
                    transition: all 0.3s;
                }

                .sidebar:hover .sidebar-title {
                    opacity: 1;
                    transform: translateX(0);
                }

                .nav-menu {
                    flex: 1;
                    padding: 1rem 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                @media (max-width: 768px) {
                    .nav-menu {
                        flex-direction: row;
                        width: 100%;
                        justify-content: space-around;
                        padding: 0;
                        gap: 0;
                    }
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    color: #94a3b8;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                    width: 100%;
                    font-size: 1rem;
                }

                @media (max-width: 768px) {
                    /* Restore standard list view for nav items in drawer */
                }

                .nav-item:hover, .nav-item.active {
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                    border-right: 3px solid var(--color-primary, #6366f1);
                }

                .nav-icon {
                    min-width: 32px;
                    font-size: 1.5rem;
                    margin-right: 1rem;
                    display: flex;
                    justify-content: center;
                }

                .nav-text {
                    opacity: 0;
                    transform: translateX(-10px);
                    transition: all 0.3s;
                }

                .sidebar:hover .nav-text {
                    opacity: 1;
                    transform: translateX(0);
                }

                .sidebar-footer {
                    padding: 1rem 0;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }

                .logout-btn:hover {
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                    border-right-color: #ef4444;
                }

                /* Main Content */
                .main-content {
                    flex: 1;
                    padding: 3rem;
                    overflow-y: auto;
                }

                @media (max-width: 768px) {
                    .main-content {
                        padding: 1rem;
                        padding-bottom: 80px; 
                    }
                    .projects-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    .welcome-banner {
                        margin-bottom: 1.5rem;
                    }
                    .welcome-banner h1 {
                        font-size: 1.8rem;
                    }
                }

                .welcome-banner {
                    margin-bottom: 3rem;
                }
                .welcome-banner h1 {
                    font-size: 2.5rem;
                    margin-bottom: 0.5rem;
                }
                .welcome-banner p {
                    color: #94a3b8;
                }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .project-card {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 1.5rem;
                    transition: transform 0.2s;
                }
                .project-card:hover {
                    transform: translateY(-5px);
                    background: rgba(30, 41, 59, 0.6);
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1.5rem;
                }
                .card-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: white;
                }
                .status-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 50px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    background: rgba(255,255,255,0.1);
                }
                .status-badge.active {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.75rem;
                    font-size: 0.9rem;
                }
                .info-row label {
                    color: #94a3b8;
                }
                
                .loading-screen {
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #0f172a;
                }
                .empty-state {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 4rem;
                    color: #94a3b8;
                    font-size: 1.2rem;
                }

                /* Animations */
                .fade-in { animation: fadeIn 0.5s ease-out; }
                .fade-in-up { animation: fadeInUp 0.5s ease-out; }


                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                .task-item-mini {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                    margin-bottom: 0.5rem;
                    transition: background 0.2s;
                }
                .task-item-mini:hover {
                    background: rgba(255,255,255,0.06);
                }
                .status-select {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #94a3b8;
                    border-radius: 6px;
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    outline: none;
                    width: 100px;
                }
                .status-select.in-process {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }
                .status-select.completed {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }
                .done-text {
                    text-decoration: line-through;
                    color: #64748b;
                }
                .task-date {
                    margin-left: auto;
                    font-size: 0.75rem;
                    color: #64748b;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .stat-card {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    transition: transform 0.2s;
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                    background: rgba(30, 41, 59, 0.6);
                }
                .stat-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    background: rgba(255, 255, 255, 0.05);
                }
                .stat-card.total .stat-icon { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
                .stat-card.assigned .stat-icon { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
                .stat-card.completed .stat-icon { background: rgba(16, 185, 129, 0.2); color: #10b981; }
                .stat-card.cancelled .stat-icon { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

                .stat-info h3 {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #94a3b8;
                    margin-bottom: 0.25rem;
                }
                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: white;
                }
                
                .btn-icon-chat {
                    background: rgba(99, 102, 241, 0.2);
                    border: 1px solid #6366f1;
                    color: white;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.2s;
                    margin-right: 0.5rem;
                }
                .btn-icon-chat:hover {
                    background: #6366f1;
                    transform: scale(1.1);
                }

                /* Reuse Modal Styles from Admin if possible, or define here */
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(5px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content.chat-modal {
                    width: 90%;
                    background: #1e293b;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                }

                /* Notification Styles (Copied from Admin) */
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
                    left: -280px; /* Shift left to align with bell on right side of screen if needed, or left: 0 if container is left aligned */
                    right: auto;
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
                    text-align: left;
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
        </div >
    );
};

export default EmployeeDashboard;
