import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Portal from './components/Portal';
import Login from './components/Login';
import AdminLogin from './components/AdminLogin';
import EmployeeDashboard from './components/EmployeeDashboard';
import ClientDashboard from './components/ClientDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/login/:orgId" element={<Login />} />
        <Route path="/:orgId/admin" element={<AdminLogin />} />
        <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
