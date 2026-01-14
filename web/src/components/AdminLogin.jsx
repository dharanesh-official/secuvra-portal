import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import secuvraLogo from '../assets/logo.png';
import securedInfraLogo from '../assets/securedinfra.png';
import letsBrandUsLogo from '../assets/letsbrandus.png';

import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

import AdminDashboard from './AdminDashboard';

const AdminLogin = () => {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const storedAuth = localStorage.getItem(`admin_auth_${orgId}`);
        if (storedAuth === 'true') {
            setIsAuthenticated(true); // Optimistic UI update
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Check if user is admin for this org
                let isAuthorized = false;
                if (orgId === 'securedinfra' && user.email === 'admin@securedinfra.com') isAuthorized = true;
                else if (orgId === 'letsbrandus' && user.email === 'admin@letsbrandus.com') isAuthorized = true;
                else if (orgId === 'secuvra' && user.email === 'admin@secuvra.com') isAuthorized = true;

                if (isAuthorized) {
                    setIsAuthenticated(true);
                    localStorage.setItem(`admin_auth_${orgId}`, 'true');
                } else {
                    // If not authorized, sign out
                    auth.signOut();
                    setError('Access denied for this organization.');
                    setIsAuthenticated(false);
                    localStorage.removeItem(`admin_auth_${orgId}`);
                }
            } else {
                // Only unset if we don't have a persisted valid session (though firebase usually handles this)
                // But wait, if firebase loads slowly, user might be null initially.
                // We trust onAuthStateChanged to eventually fire with user if logged in.
                // If it fires with null, then we strictly logout.
                setIsAuthenticated(false);
                localStorage.removeItem(`admin_auth_${orgId}`);
            }
            setIsLoading(false); // Auth check done
        });

        return () => unsubscribe();
    }, [orgId]);

    // ... (keep getOrgDetails and org) ...
    const getOrgDetails = (id) => {
        switch (id) {
            case 'securedinfra':
                return {
                    name: 'SecuredInfra',
                    logo: securedInfraLogo,
                    theme: {
                        '--color-primary': '#0ea5e9',
                        '--color-secondary': '#2563eb',
                        '--color-primary-glow': 'rgba(14, 165, 233, 0.5)'
                    }
                };
            case 'letsbrandus':
                return {
                    name: "Let's Brand Us",
                    logo: letsBrandUsLogo,
                    theme: {
                        '--color-primary': '#f59e0b',
                        '--color-secondary': '#db2777',
                        '--color-primary-glow': 'rgba(245, 158, 11, 0.5)'
                    }
                };
            case 'secuvra':
                return {
                    name: 'Secuvra',
                    logo: secuvraLogo,
                    theme: {
                        '--color-primary': '#6366f1',
                        '--color-secondary': '#a855f7',
                        '--color-primary-glow': 'rgba(99, 102, 241, 0.5)'
                    }
                };
            default:
                return {
                    name: 'Unknown',
                    logo: secuvraLogo,
                    theme: {}
                };
        }
    };

    const org = getOrgDetails(orgId);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            // Authenticate with Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Strict Access Control: Verify Admin belongs to this Organization
            let isAuthorized = false;

            if (orgId === 'securedinfra' && user.email === 'admin@securedinfra.com') isAuthorized = true;
            else if (orgId === 'letsbrandus' && user.email === 'admin@letsbrandus.com') isAuthorized = true;
            else if (orgId === 'secuvra' && user.email === 'admin@secuvra.com') isAuthorized = true;

            if (isAuthorized) {
                console.log(`Logged in as Admin for ${orgId}`);
                setIsAuthenticated(true);
            } else {
                await auth.signOut();
                setError(`Access Denied. You are not an admin for ${org.name}.`);
            }
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/invalid-credential') setError('Invalid Email or Password.');
            else if (err.code === 'auth/user-not-found') setError('No admin account found with this email.');
            else if (err.code === 'auth/wrong-password') setError('Incorrect password.');
            else if (err.code === 'auth/too-many-requests') setError('Too many failed attempts. Try again later.');
            else setError('Login failed. Check console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await auth.signOut();
        setIsAuthenticated(false);
        localStorage.removeItem(`admin_auth_${orgId}`);
        setEmail('');
        setPassword('');
    };

    if (isAuthenticated) {
        return <AdminDashboard org={org} orgId={orgId} onLogout={handleLogout} />;
    }

    return (
        <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', ...org.theme }}>
            {/* ... (Login Form UI remains exactly the same) ... */}
            {/* ... (Login Form UI remains exactly the same) ... */}
            <div className="hero-bg-glow" style={{ top: '50%', transform: 'translate(-50%, -50%)', width: '800px', maxWidth: '100vw', height: '800px', maxHeight: '100vh' }}></div>

            <div className="glass" style={{ padding: '3rem', borderRadius: '24px', width: '100%', maxWidth: '450px', position: 'relative', zIndex: 10, border: '1px solid var(--color-primary)' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '1.5rem' }}
                >
                    ←
                </button>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src={org.logo} alt={org.name} style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '1rem' }} />
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{org.name}</h2>
                    <p style={{ color: 'var(--color-primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Portal</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    <div style={{ padding: '1rem', background: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)', borderRadius: '8px', color: '#ffaaaa', fontSize: '0.9rem', textAlign: 'center' }}>
                        Restricted Access. Authorized Personnel Only.
                    </div>

                    {error && (
                        <div style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Admin Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', outline: 'none' }}
                            placeholder="admin@company.com"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', outline: 'none' }}
                            placeholder="••••••••"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', background: 'var(--color-secondary)', boxShadow: '0 4px 14px 0 rgba(0,0,0,0.3)' }} disabled={isLoading}>
                        {isLoading ? 'Authenticating...' : 'Authenticate'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
