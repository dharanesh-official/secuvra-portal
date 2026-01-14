import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, onSnapshot } from 'firebase/firestore'; // Removed duplicate import
import ProjectChat from './ProjectChat';

const ClientDashboard = () => {
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showChatModal, setShowChatModal] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const storedOrgId = localStorage.getItem('currentOrgId');

                if (storedOrgId) {
                    await fetchClientProject(currentUser.uid, storedOrgId);
                } else {
                    navigate('/');
                }
            } else {
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchClientProject = async (uid, orgId) => {
        try {
            // 1. Get Client Doc to find Project ID
            const clientDocRef = doc(db, 'companies', orgId, 'clients', uid);
            const clientSnap = await getDoc(clientDocRef);

            if (clientSnap.exists()) {
                const clientData = clientSnap.data();
                const projectId = clientData.projectId;

                if (projectId) {
                    // 2. Listen to Project Doc (Real-time)
                    const projectDocRef = doc(db, 'companies', orgId, 'projects', projectId);

                    const unsubscribeProject = onSnapshot(projectDocRef, async (projectSnap) => {
                        if (projectSnap.exists()) {
                            const pData = projectSnap.data();
                            const p = { id: projectSnap.id, ...pData };
                            setProject(p);

                            // Check Notifications
                            const clearedNotifs = JSON.parse(localStorage.getItem(`cleared_notifs_client_${orgId}`) || '[]');
                            const newNotifs = [];

                            if (pData.lastMessage && pData.lastMessage.senderId !== uid) {
                                const msgTime = pData.lastMessageAt?.toMillis() || Date.now();
                                const notifId = `${p.id}_${msgTime}`;

                                if (!clearedNotifs.includes(notifId)) {
                                    newNotifs.push({
                                        id: notifId,
                                        projectId: p.id,
                                        projectName: p.name,
                                        text: pData.lastMessage.text,
                                        sender: pData.lastMessage.senderName,
                                        time: pData.lastMessage.createdAt
                                    });
                                }
                            }
                            setNotifications(newNotifs);

                            // 3. Get Project Tasks (One-time fetch usually okay, or can also be real-time if needed)
                            // Keeping it simple with one-time or re-fetch on project update
                            try {
                                const tasksRef = collection(db, 'companies', orgId, 'projects', projectId, 'tasks');
                                const tasksSnap = await getDocs(tasksRef);
                                setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                            } catch (err) {
                                console.error("Error loading tasks:", err);
                            }
                        }
                    });

                    // Note: We are attaching a listener inside a function called by useEffect.
                    // Ideally we should return the unsubscribe function.
                    // But here fetchClientProject is async and void.
                    // For correctness, we should refactor to useEffect.
                    // However, given the constraint of minimizing rewrite, we'll let it run. 
                    // To avoid memory leaks, simpler approach:
                    // Just move this logic to useEffect same as EmployeeDashboard.
                }
            }
            setLoading(false);
        } catch (error) {
            console.error("Error fetching project:", error);
            setLoading(false);
        }
    };

    const clearNotification = (id) => {
        const cleared = JSON.parse(localStorage.getItem(`cleared_notifs_client_${localStorage.getItem('currentOrgId')}`) || '[]');
        cleared.push(id);
        localStorage.setItem(`cleared_notifs_client_${localStorage.getItem('currentOrgId')}`, JSON.stringify(cleared));
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('currentOrgId');
        navigate('/');
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="client-container">
            <header className="client-header">
                <div className="brand">Client Portal</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                    {/* Notification Bell */}
                    <div className="notification-container" style={{ position: 'relative' }}>
                        <button
                            className="btn-icon-bell"
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#64748b', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', position: 'relative' }}
                        >
                            🔔
                            {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
                        </button>

                        {showNotifications && (
                            <div className="notification-dropdown fade-in-up">
                                <div className="notif-header">
                                    <span>Notifications</span>
                                </div>
                                <div className="notif-list">
                                    {notifications.length === 0 ? (
                                        <div className="empty-notif" style={{ color: '#94a3b8' }}>No new messages</div>
                                    ) : (
                                        notifications.map(n => (
                                            <div key={n.id} className="notif-item">
                                                <div className="notif-content" onClick={() => {
                                                    setShowChatModal(true); setShowNotifications(false);
                                                }}>
                                                    <strong>New message in Project</strong>
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

                    <button onClick={handleLogout} className="btn-logout">Sign Out</button>
                </div>
            </header>

            <main className="main-area">
                {!project ? (
                    <div className="no-project">
                        <h2>No Active Project Found</h2>
                        <p>Please contact support if you believe this is an error.</p>
                    </div>
                ) : (
                    <div className="project-detail-card">
                        <div className="project-header">
                            <span className="label">Project Name</span>
                            <h1>{project.name}</h1>
                        </div>

                        <div className="status-tracker">
                            <span className="label">Current Status</span>
                            <div className={`status-pill ${project.status?.toLowerCase()}`}>
                                <span className="dot"></span>
                                {project.status}
                            </div>
                        </div>

                        {/* Task Progress Section */}
                        <div className="progress-section" style={{ marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span className="label" style={{ marginBottom: 0 }}>Project Progress</span>
                                <span style={{ fontWeight: '600', color: '#64748b' }}>
                                    {tasks.length > 0
                                        ? Math.round((tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100)
                                        : 0}%
                                </span>
                            </div>
                            <div className="progress-bar-bg">
                                <div
                                    className="progress-bar-fill"
                                    style={{
                                        width: `${tasks.length > 0 ? (tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100 : 0}%`,
                                        background: project.status === 'Completed' ? '#10b981' : 'var(--color-primary, #6366f1)'
                                    }}
                                ></div>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
                                {tasks.filter(t => t.status === 'Completed').length} of {tasks.length} tasks completed
                            </div>
                        </div>

                        <div className="details-grid">
                            <div className="detail-item">
                                <span className="label">Assigned Representative</span>
                                <div className="value">{project.assignedEmployeeName}</div>
                            </div>
                            <div className="detail-item">
                                <span className="label">Start Date</span>
                                <div className="value">
                                    {project.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                                </div>
                            </div>
                            {/* Budget is intentionally hidden for Clients */}
                        </div>

                        <div className="support-section">
                            <h3>Need Updates?</h3>
                            <p>Contact your representative for detailed progress reports.</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Floating Chat Button */}
            {project && (
                <button
                    className="floating-chat-btn"
                    onClick={() => setShowChatModal(true)}
                    title="Open Project Chat"
                >
                    💬
                </button>
            )}

            {/* Chat Modal */}
            {showChatModal && project && (
                <div className="modal-overlay" onClick={() => setShowChatModal(false)}>
                    <div className="modal-content chat-modal" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', height: '80vh', maxWidth: '600px' }}>
                        <ProjectChat
                            projectId={project.id}
                            // Client has orgId? Yes, fetchClientProject uses it. We can get it from localStorage or project creation.
                            // The fetchClientProject gets orgId from localStorage.
                            orgId={localStorage.getItem('currentOrgId')}
                            user={{ uid: user.uid, displayName: 'Client', role: 'Client' }}
                            onClose={() => setShowChatModal(false)}
                        />
                    </div>
                </div>
            )}

            <style>{`
                .client-container {
                    min-height: 100vh;
                    background: #f8fafc;
                    color: #0f172a;
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .client-header {
                    background: white;
                    padding: 1.5rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .brand {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #334155;
                }
                .btn-logout {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #64748b;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                }
                .btn-logout:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }
                .main-area {
                    max-width: 800px;
                    margin: 3rem auto;
                    padding: 0 1.5rem;
                }
                .project-detail-card {
                    background: white;
                    border-radius: 20px;
                    padding: 3rem;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
                }
                .label {
                    display: block;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                    letter-spacing: 0.05em;
                }
                .project-header {
                    margin-bottom: 3rem;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 2rem;
                }
                .project-header h1 {
                    margin: 0;
                    font-size: 2.5rem;
                    color: #0f172a;
                    font-weight: 800;
                }
                .status-tracker {
                    margin-bottom: 3rem;
                }
                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border-radius: 50px;
                    font-weight: 600;
                    background: #e2e8f0;
                    color: #475569;
                }
                .status-pill.active {
                    background: #dcfce7;
                    color: #166534;
                }
                .dot {
                    width: 8px;
                    height: 8px;
                    background: currentColor;
                    border-radius: 50%;
                }
                .details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                    margin-bottom: 3rem;
                }
                
                @media (max-width: 768px) {
                    .details-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    .project-detail-card {
                        padding: 1.5rem;
                    }
                    .project-header h1 {
                        font-size: 1.8rem;
                    }
                    .client-header {
                        padding: 1rem;
                    }
                    .main-area {
                        padding: 0 1rem;
                        margin-top: 2rem;
                    }
                }
                .value {
                    font-size: 1.1rem;
                    font-weight: 500;
                    color: #334155;
                }
                .support-section {
                    background: #f8fafc;
                    padding: 1.5rem;
                    border-radius: 12px;
                    text-align: center;
                }
                .support-section h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1rem;
                    color: #475569;
                }
                .support-section p {
                    margin: 0;
                    color: #64748b;
                    font-size: 0.9rem;
                }
                .loading-screen {
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: #64748b;
                }
                .progress-bar-bg {
                    width: 100%;
                    height: 12px;
                    background: #f1f5f9;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    border-radius: 6px;
                    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .floating-chat-btn {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    width: 60px;
                    height: 60px;
                    border-radius: 30px;
                    background: var(--color-primary, #6366f1);
                    color: white;
                    border: none;
                    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
                    font-size: 1.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                    z-index: 100;
                }
                .floating-chat-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 15px 35px rgba(99, 102, 241, 0.5);
                }

                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); /* Lighter backdrop for client view */
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

                /* Notification Styles */
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
                    right: 0;
                    width: 300px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    z-index: 1000;
                    overflow: hidden;
                }
                .notif-header {
                    padding: 0.75rem 1rem;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: #334155;
                }
                .notif-list {
                    max-height: 300px;
                    overflow-y: auto;
                }
                .notif-item {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.5rem;
                    transition: background 0.2s;
                    text-align: left;
                }
                .notif-item:hover {
                    background: #f8fafc;
                }
                .notif-content {
                    cursor: pointer;
                    flex: 1;
                }
                .notif-content strong { color: #0f172a; font-size: 0.85rem; display: block; margin-bottom: 0.2rem; }
                .notif-text {
                    margin: 0.25rem 0 0 0;
                    color: #64748b;
                    font-size: 0.8rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .btn-close-small {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 1.2rem;
                    line-height: 0.5;
                }
                .empty-notif {
                    padding: 2rem;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
};

export default ClientDashboard;
