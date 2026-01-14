import { useNavigate } from 'react-router-dom';
import secuvraLogo from '../assets/logo.png';
import securedInfraLogo from '../assets/securedinfra.png';
import letsBrandUsLogo from '../assets/letsbrandus.png';

const Portal = () => {
    const navigate = useNavigate();

    const handleOrgClick = (orgId) => {
        navigate(`/login/${orgId}`);
    };

    return (
        <div className="app-container">
            <main className="hero" style={{ flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                <div className="hero-bg-glow"></div>

                <section className="companies-section">
                    <h2 className="subtitle-small" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                        Centralized Gateway
                    </h2>
                    <h1 className="title" style={{ textAlign: 'center', marginBottom: '3rem', marginTop: 0 }}>
                        Choose Your <span className="gradient-text">Organization</span>
                    </h1>
                    <div className="companies-grid">
                        {/* SecuredInfra - Blue/Cyan Theme */}
                        <div
                            className="company-card glass"
                            onClick={() => handleOrgClick('securedinfra')}
                            style={{
                                '--color-primary': '#0ea5e9',
                                '--color-secondary': '#2563eb',
                                '--color-primary-glow': 'rgba(14, 165, 233, 0.5)'
                            }}
                        >
                            <img src={securedInfraLogo} alt="SecuredInfra" className="company-logo" />
                            <h3 className="company-name">SecuredInfra</h3>
                            <p className="company-desc">Robust infrastructure security solutions for enterprise environments.</p>
                            <div className="card-arrow">
                                Login <span>→</span>
                            </div>
                        </div>

                        {/* Let's Brand Us - Orange/Pink Theme */}
                        <div
                            className="company-card glass"
                            onClick={() => handleOrgClick('letsbrandus')}
                            style={{
                                '--color-primary': '#f59e0b',
                                '--color-secondary': '#db2777',
                                '--color-primary-glow': 'rgba(245, 158, 11, 0.5)'
                            }}
                        >
                            <img src={letsBrandUsLogo} alt="Let's Brand Us" className="company-logo" />
                            <h3 className="company-name">Let's Brand Us</h3>
                            <p className="company-desc">Creative branding and digital marketing strategies for growth.</p>
                            <div className="card-arrow">
                                Login <span>→</span>
                            </div>
                        </div>

                        {/* Secuvra - Indigo/Purple Theme (Default) */}
                        <div
                            className="company-card glass"
                            onClick={() => handleOrgClick('secuvra')}
                            style={{
                                '--color-primary': '#6366f1',
                                '--color-secondary': '#a855f7',
                                '--color-primary-glow': 'rgba(99, 102, 241, 0.5)'
                            }}
                        >
                            <img src={secuvraLogo} alt="Secuvra" className="company-logo" />
                            <h3 className="company-name">Secuvra</h3>
                            <p className="company-desc">Next-gen personal security synchronized across all devices.</p>
                            <div className="card-arrow">
                                Login <span>→</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Portal;
