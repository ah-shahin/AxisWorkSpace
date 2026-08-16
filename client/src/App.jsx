import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ActiveVisits from './pages/ActiveVisits';
import CheckIn from './pages/CheckIn';
import Customers from './pages/Customers';
import Rooms from './pages/Rooms';
import Reports from './pages/Reports';
import History from './pages/History';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ActiveVisits />} />
        <Route path="check-in" element={<CheckIn />} />
        <Route path="customers" element={<Customers />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="reports" element={<Reports />} />
        <Route path="history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
