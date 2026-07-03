import { useState, useEffect } from 'react';
import { getTodayReport } from '../api';
import Spinner from '../components/Spinner';

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await getTodayReport();
        setReport(res.data);
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load report.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Today's Report</h1>
        <span className="page-subtitle">{today}</span>
      </div>

      {loading && <Spinner />}
      {error   && <p className="error-text">{error}</p>}

      {report && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">
              EGP {parseFloat(report.revenue || 0).toFixed(2)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Visitors Today</span>
            <span className="stat-value">{report.visitor_count}</span>
            <span className="stat-sub">people (groups counted individually)</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Check-ins Today</span>
            <span className="stat-value">{report.visit_count}</span>
            <span className="stat-sub">groups / individual visits</span>
          </div>
        </div>
      )}
    </div>
  );
}
