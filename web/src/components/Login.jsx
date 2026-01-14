import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import secuvraLogo from '../assets/logo.png';
import securedInfraLogo from '../assets/securedinfra.png';
import letsBrandUsLogo from '../assets/letsbrandus.png';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const Login = () => {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const [role, setRole] = useState(null); // 'employee', 'client', or null
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false); // New loading state

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
        setLoading(true); // Start loading
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Strict Access Control
            if (role === 'employee') {
                const employeeRef = doc(db, "companies", orgId, "employees", user.uid);
                const employeeSnap = await getDoc(employeeRef);

                if (!employeeSnap.exists()) {
                    await auth.signOut();
                    setError(`Access Denied. You are not a registered employee of ${org.name}.`);
                    setLoading(false);
                    return;
                }

                localStorage.setItem('currentOrgId', orgId);
                navigate('/employee-dashboard');
            }
            else if (role === 'client') {
                const clientRef = doc(db, "companies", orgId, "clients", user.uid);
                const clientSnap = await getDoc(clientRef);

                if (!clientSnap.exists()) {
                    await auth.signOut();
                    setError(`Access Denied. Client account not found in ${org.name}.`);
                    setLoading(false);
                    return;
                }

                localStorage.setItem('currentOrgId', orgId);
                navigate('/client-dashboard');
            }

        } catch (err) {
            console.error(err);
            setLoading(false); // Stop loading on error
            let msg = 'Failed to login.';
            if (err.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
            setError(msg);
        }
    };

    return (
        <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', ...org.theme }}>
            <div className="hero-bg-glow" style={{ top: '50%', transform: 'translate(-50%, -50%)', width: '800px', maxWidth: '100vw', height: '800px', maxHeight: '100vh' }}></div>

            <div className="glass" style={{ padding: '3rem', borderRadius: '24px', width: '100%', maxWidth: '450px', position: 'relative', zIndex: 10 }}>
                <button
                    onClick={() => role ? setRole(null) : navigate('/')}
                    style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '1.5rem' }}
                >
                    ←
                </button>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src={org.logo} alt={org.name} style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '1rem' }} />
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{org.name}</h2>
                    <p style={{ color: 'var(--color-text-muted)' }}>Sign in to continue</p>
                </div>

                {!role ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button className="btn btn-outlined" onClick={() => setRole('employee')} style={{ justifyContent: 'center', padding: '1rem' }}>
                            Employee Login
                        </button>
                        <button className="btn btn-outlined" onClick={() => setRole('client')} style={{ justifyContent: 'center', padding: '1rem' }}>
                            Client Login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ background: 'var(--color-primary)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                                {role} Login
                            </span>
                        </div>

                        {error && (
                            <div style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                                {error}
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', outline: 'none' }}
                                placeholder="name@company.com"
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
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} disabled={loading}>
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    Signing In...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
