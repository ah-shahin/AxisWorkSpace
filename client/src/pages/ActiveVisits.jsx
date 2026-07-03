import { useState, useEffect, useCallback, Fragment } from 'react';
import { getActiveVisits, checkOut, checkOutMember, checkOutMain } from '../api';
import { perPersonShare } from '../pricing';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(checkIn, now) {
  const minutes = Math.max(0, Math.floor((now - new Date(checkIn)) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const money = (n) => `EGP ${parseFloat(n).toFixed(2)}`;

export default function ActiveVisits() {
  const [visits, setVisits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Ticking clock so durations and live per-person amounts update on their own.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const [expanded, setExpanded] = useState({});

  // Checkout modal state
  const [checkingOut, setCheckingOut]     = useState(null); // the visit being settled
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [coLoading, setCoLoading]         = useState(false); // a checkout request in flight
  const [coError, setCoError]             = useState('');
  const [coResult, setCoResult]           = useState(null);  // final group-close summary

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getActiveVisits();
      setVisits(res.data);
      return res.data;
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load active visits.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openModal(visit) {
    setCheckingOut(visit);
    setPaymentMethod('cash');
    setCoResult(null);
    setCoError('');
  }

  function closeModal() {
    setCheckingOut(null);
    load();
  }

  // Check out one group member; refresh so the modal reflects the freed seat.
  async function handleMemberCheckout(memberId) {
    setCoLoading(true);
    setCoError('');
    try {
      await checkOutMember(checkingOut.id, memberId, { payment_method: paymentMethod });
      const fresh = await load();
      const updated = fresh.find((v) => v.id === checkingOut.id);
      setCheckingOut(updated || null); // null if the visit somehow closed
    } catch (e) {
      setCoError(e.response?.data?.error || 'Member checkout failed.');
    } finally {
      setCoLoading(false);
    }
  }

  // Check out the HOST alone. If they were the last person in, the visit closes
  // and we show the summary; otherwise the group stays and the modal refreshes.
  async function handleHostCheckout() {
    setCoLoading(true);
    setCoError('');
    try {
      const res = await checkOutMain(checkingOut.id, { payment_method: paymentMethod });
      const fresh = await load();
      const updated = fresh.find((v) => v.id === checkingOut.id);
      if (updated) {
        setCheckingOut(updated);
      } else {
        setCoResult({
          grand_total: res.data.main_amount,
          main_name: checkingOut.customer_name,
          main_amount: res.data.main_amount,
          settled_members: [],
        });
      }
    } catch (e) {
      setCoError(e.response?.data?.error || 'Host checkout failed.');
    } finally {
      setCoLoading(false);
    }
  }

  // Check out EVERYONE remaining at once -> closes the visit.
  async function handleWholeGroupCheckout() {
    setCoLoading(true);
    setCoError('');
    try {
      const res = await checkOut(checkingOut.id, { payment_method: paymentMethod });
      setCoResult(res.data);
    } catch (e) {
      setCoError(e.response?.data?.error || 'Checkout failed.');
    } finally {
      setCoLoading(false);
    }
  }

  const liveShare = (visit) =>
    perPersonShare(visit, visit.check_in, now, visit.group_size);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Active Visits</h1>
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      </div>

      {loading && <Spinner />}
      {error   && <p className="error-text">{error}</p>}

      {!loading && !error && visits.length === 0 && (
        <p className="empty-text">No one is currently checked in.</p>
      )}

      {!loading && visits.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Room</th>
                <th>Checked In</th>
                <th>Duration</th>
                <th>Group</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const hasMembers = v.members && v.members.length > 0;
                const isOpen = !!expanded[v.id];
                const stillIn = v.members ? v.members.filter((m) => !m.checked_out).length + 1 : 1;
                return (
                  <Fragment key={v.id}>
                    <tr>
                      <td className="td-name">{v.customer_name}</td>
                      <td className="td-muted">{v.customer_phone}</td>
                      <td>{v.room_name}</td>
                      <td className="td-muted">{formatTime(v.check_in)}</td>
                      <td className="td-muted">{formatDuration(v.check_in, now)}</td>
                      <td>
                        {hasMembers ? (
                          <button className="group-toggle" onClick={() => toggleExpand(v.id)}>
                            {isOpen ? '▾' : '▸'} {stillIn} of {v.group_size} in
                          </button>
                        ) : (
                          <span className="td-muted">{v.group_size}</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => openModal(v)}>
                          Check Out
                        </button>
                      </td>
                    </tr>
                    {hasMembers && isOpen && (
                      <tr className="member-detail-row">
                        <td colSpan={7}>
                          <div className="member-detail">
                            <span className="member-detail-title">Group:</span>
                            <span className="member-detail-item member-detail-main">
                              {v.customer_name} · {v.customer_phone} (main)
                            </span>
                            {v.members.map((m, i) => (
                              <span
                                className={'member-detail-item' + (m.checked_out ? ' member-gone' : '')}
                                key={i}
                              >
                                {m.name}{m.phone ? ` · ${m.phone}` : ''}
                                {m.checked_out ? ' — left' : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {checkingOut && (
        <Modal
          title={coResult ? 'Group Checked Out' : `Check Out — ${checkingOut.room_name}`}
          onClose={closeModal}
        >
          {coResult ? (
            <div className="checkout-success">
              <div className="checkout-amount">{money(coResult.grand_total)}</div>
              <p className="checkout-amount-label">collected now</p>
              <div className="settle-list">
                <div className="settle-row">
                  <span>{coResult.main_name} (main)</span>
                  <strong>{money(coResult.main_amount)}</strong>
                </div>
                {coResult.settled_members.map((m, i) => (
                  <div className="settle-row" key={i}>
                    <span>{m.name}</span>
                    <strong>{money(m.amount)}</strong>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={closeModal}>Done</button>
            </div>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Payment method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
              </div>

              <div className="participant-list">
                {/* Host — can leave on their own; the group stays open */}
                <div className="participant">
                  <div className="participant-info">
                    <span className="participant-name">{checkingOut.customer_name}</span>
                    <span className="participant-tag">host</span>
                  </div>
                  <div className="participant-action">
                    {checkingOut.main_checked_out ? (
                      <span className="participant-paid">Checked out</span>
                    ) : (
                      <>
                        <span className="participant-amount">{money(liveShare(checkingOut))}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={handleHostCheckout}
                          disabled={coLoading}
                        >
                          Check out host
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Group members — each can leave individually */}
                {checkingOut.members.map((m) => (
                  <div className="participant" key={m.id}>
                    <div className="participant-info">
                      <span className="participant-name">{m.name}</span>
                      <span className="participant-sub">{m.phone}</span>
                    </div>
                    <div className="participant-action">
                      {m.checked_out ? (
                        <span className="participant-paid">Paid {money(m.total_price)}</span>
                      ) : (
                        <>
                          <span className="participant-amount">{money(liveShare(checkingOut))}</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleMemberCheckout(m.id)}
                            disabled={coLoading}
                          >
                            Check out
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {coError && <p className="error-text">{coError}</p>}

              <div className="modal-actions">
                <button
                  className="btn btn-danger"
                  onClick={handleWholeGroupCheckout}
                  disabled={coLoading}
                >
                  Check out whole group
                </button>
              </div>
              <p className="checkout-note">
                Each person pays for their own time. You can check out the host or
                any member on their own, or check out the whole group at once.
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
