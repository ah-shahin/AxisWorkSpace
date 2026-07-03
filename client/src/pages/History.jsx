import { useState, useEffect } from 'react';
import { getHistory } from '../api';
import Spinner from '../components/Spinner';

const money = (n) => `EGP ${parseFloat(n || 0).toFixed(2)}`;

// Group flat payment rows into { dateKey, label, total, entries[] } per day.
function groupByDay(rows) {
  const days = new Map();
  for (const r of rows) {
    const d = new Date(r.paid_at);
    const key = d.toISOString().slice(0, 10);
    if (!days.has(key)) {
      days.set(key, {
        key,
        label: d.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
        total: 0,
        entries: [],
      });
    }
    const day = days.get(key);
    day.total += parseFloat(r.amount || 0);
    day.entries.push(r);
  }
  return Array.from(days.values());
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function History() {
  const [days, setDays]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [openDay, setOpenDay] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await getHistory();
        const grouped = groupByDay(res.data);
        setDays(grouped);
        if (grouped.length > 0) setOpenDay(grouped[0].key); // expand most recent day
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load history.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">History</h1>
        <span className="page-subtitle">Day-by-day record of checkouts</span>
      </div>

      {loading && <Spinner />}
      {error   && <p className="error-text">{error}</p>}

      {!loading && !error && days.length === 0 && (
        <p className="empty-text">No checkouts recorded yet.</p>
      )}

      <div className="history-days">
        {days.map((day) => {
          const isOpen = openDay === day.key;
          return (
            <div className="card history-day" key={day.key}>
              <button
                className="history-day-header"
                onClick={() => setOpenDay(isOpen ? null : day.key)}
              >
                <span className="history-day-toggle">{isOpen ? '▾' : '▸'}</span>
                <span className="history-day-label">{day.label}</span>
                <span className="history-day-meta">
                  {day.entries.length} checkout{day.entries.length > 1 ? 's' : ''}
                  <strong className="history-day-total">{money(day.total)}</strong>
                </span>
              </button>

              {isOpen && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Room</th>
                      <th>Payment</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.entries.map((e, i) => (
                      <tr key={i}>
                        <td className="td-muted">{formatTime(e.paid_at)}</td>
                        <td className="td-name">{e.name}</td>
                        <td className="td-muted">{e.role}</td>
                        <td>{e.room_name}</td>
                        <td className="td-muted">{e.payment_method}</td>
                        <td>{money(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
