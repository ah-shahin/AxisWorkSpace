import { useState, useEffect } from 'react';
import { getAllRooms } from '../api';
import Spinner from '../components/Spinner';

export default function Rooms() {
  const [rooms, setRooms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // /api/rooms now returns live occupancy (occupied, free_places) per room.
        const res = await getAllRooms();
        setRooms(res.data);
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load rooms.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rooms</h1>
      </div>

      {loading && <Spinner />}
      {error   && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Hourly Rate</th>
                <th>Daily Rate</th>
                <th>Billing</th>
                <th>Occupancy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const free = r.free_places > 0;
                return (
                  <tr key={r.id}>
                    <td className="td-name">{r.name}</td>
                    <td>{r.type_name}</td>
                    <td>EGP {parseFloat(r.hourly_rate).toFixed(2)}</td>
                    <td>EGP {parseFloat(r.daily_rate).toFixed(2)}</td>
                    <td className="td-muted">{r.pricing_mode}</td>
                    <td className="td-muted">
                      {r.occupied} / {r.max_capacity} used
                      <span className="free-seats"> · {r.free_places} free</span>
                    </td>
                    <td>
                      <span className={`badge badge--${free ? 'free' : 'occupied'}`}>
                        {free ? 'Available' : 'Full'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
