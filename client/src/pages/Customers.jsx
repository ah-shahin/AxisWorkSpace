import { useState, useEffect, useCallback } from 'react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';
import Spinner from '../components/Spinner';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState('');

  // Add-customer form
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk]       = useState('');

  // Inline edit state
  const [editId, setEditId]       = useState(null);
  const [editName, setEditName]   = useState('');
  const [editPhone, setEditPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCustomers();
      setCustomers(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setFormError('');
    setFormOk('');
    try {
      const res = await createCustomer({ name: name.trim(), phone: phone.trim() });
      // POST is find-or-create: 201 = created, 200 = already existed.
      setFormOk(
        res.status === 201
          ? `Added ${res.data.name}.`
          : `${res.data.name} already exists with that phone.`
      );
      setName('');
      setPhone('');
      load();
    } catch (e) {
      setFormError(e.response?.data?.error || 'Failed to add customer.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c) {
    setEditId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone);
    setError('');
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit(id) {
    if (!editName.trim() || !editPhone.trim()) return;
    setError('');
    try {
      await updateCustomer(id, { name: editName.trim(), phone: editPhone.trim() });
      setEditId(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save changes.');
    }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    setError('');
    try {
      await deleteCustomer(c.id);
      load();
    } catch (e) {
      // 409 = customer has visit history and can't be removed.
      setError(e.response?.data?.error || 'Failed to delete customer.');
    }
  }

  const visible = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.phone.includes(filter)
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
      </div>

      {/* Add new customer */}
      <div className="checkin-step">
        <h2 className="section-title">Add New Customer</h2>
        <form className="add-customer-form" onSubmit={handleAdd}>
          <input
            className="form-input"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="form-input"
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || !name.trim() || !phone.trim()}
          >
            {saving ? 'Adding...' : 'Add Customer'}
          </button>
        </form>
        {formError && <p className="error-text">{formError}</p>}
        {formOk    && <p className="success-text">{formOk}</p>}
      </div>

      {/* Existing customers */}
      <div className="section-title" style={{ marginTop: '8px' }}>
        All Customers ({customers.length})
      </div>

      <div className="search-row" style={{ maxWidth: '340px' }}>
        <input
          className="form-input"
          type="text"
          placeholder="Filter by name or phone..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading && <Spinner />}
      {error   && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Total Visits</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-text">No customers found.</td>
                </tr>
              ) : (
                visible.map((c) =>
                  editId === c.id ? (
                    <tr key={c.id}>
                      <td>
                        <input
                          className="form-input"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="tel"
                          inputMode="numeric"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                        />
                      </td>
                      <td className="td-muted">{c.visit_count}</td>
                      <td className="td-muted">{formatDate(c.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => saveEdit(c.id)}
                            disabled={!editName.trim() || !editPhone.trim()}
                          >
                            Save
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id}>
                      <td className="td-name">{c.name}</td>
                      <td className="td-muted">{c.phone}</td>
                      <td className="td-muted">{c.visit_count}</td>
                      <td className="td-muted">{formatDate(c.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(c)}
                            title={c.visit_count > 0 ? 'Has visit history' : 'Delete customer'}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
