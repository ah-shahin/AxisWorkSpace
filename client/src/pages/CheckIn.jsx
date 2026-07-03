import { useState } from 'react';
import { searchCustomers, createCustomer, getFreeRooms, checkIn } from '../api';
import Spinner from '../components/Spinner';
import MemberInput from '../components/MemberInput';

export default function CheckIn() {
  // Customer search
  const [phone, setPhone]           = useState('');
  const [searching, setSearching]   = useState(false);
  const [results, setResults]       = useState([]);
  const [searched, setSearched]     = useState(false);
  const [searchError, setSearchError] = useState('');

  // New customer form (shown when no results)
  const [newName, setNewName]       = useState('');
  const [newPhone, setNewPhone]     = useState('');
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState('');

  // Selected customer
  const [customer, setCustomer]     = useState(null);

  // Room selection
  const [freeRooms, setFreeRooms]   = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Group + members + submit
  const [groupSize, setGroupSize]   = useState(1);
  const [members, setMembers]       = useState([]); // the extra people (group_size - 1)
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess]       = useState(false);

  async function handleSearch() {
    if (!phone.trim()) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    setSearched(false);
    try {
      const res = await searchCustomers(phone);
      setResults(res.data);
      setSearched(true);
      if (res.data.length === 0) {
        // Pre-fill the new-customer form: if they searched digits, it's a phone;
        // otherwise it's a name.
        const term = phone.trim();
        if (/^\d+$/.test(term)) {
          setNewPhone(term);
          setNewName('');
        } else {
          setNewName(term);
          setNewPhone('');
        }
      }
    } catch (e) {
      setSearchError(e.response?.data?.error || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function loadFreeRooms() {
    setLoadingRooms(true);
    setRoomsError('');
    try {
      const res = await getFreeRooms();
      setFreeRooms(res.data);
    } catch (e) {
      setRoomsError(e.response?.data?.error || 'Could not load available rooms.');
    } finally {
      setLoadingRooms(false);
    }
  }

  function selectCustomer(c) {
    setCustomer(c);
    loadFreeRooms();
  }

  async function handleCreate() {
    if (!newName.trim() || !newPhone.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await createCustomer({ name: newName.trim(), phone: newPhone.trim() });
      selectCustomer(res.data);
    } catch (e) {
      setCreateError(e.response?.data?.error || 'Failed to create customer.');
    } finally {
      setCreating(false);
    }
  }

  function clearCustomer() {
    setCustomer(null);
    setFreeRooms([]);
    setSelectedRoom(null);
    setGroupSize(1);
    setMembers([]);
    setSubmitError('');
  }

  // Resize the members list to match (group_size - 1), preserving what's typed.
  // Cap at free_places so staff can't book more people than the room can hold.
  function handleGroupSizeChange(value) {
    const max = selectedRoom.free_places;
    const size = Math.max(1, Math.min(max, Number(value) || 1));
    setGroupSize(size);
    const needed = size - 1;
    setMembers((prev) => {
      const next = prev.slice(0, needed);
      while (next.length < needed) next.push({ name: '', phone: '', customer_id: null });
      return next;
    });
  }

  function updateMemberRow(index, nextMember) {
    setMembers((prev) => prev.map((m, i) => (i === index ? nextMember : m)));
  }

  const membersComplete = members.every(
    (m) => m.name.trim() && m.phone.trim()
  );

  async function handleCheckIn() {
    if (!selectedRoom || !membersComplete) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await checkIn({
        customer_id: customer.id,
        room_id: selectedRoom.id,
        created_by: 1,
        group_size: groupSize,
        members,
      });
      setSuccess(true);
    } catch (e) {
      setSubmitError(e.response?.data?.error || 'Check-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPhone('');
    setResults([]);
    setSearched(false);
    setSearchError('');
    setNewName('');
    setNewPhone('');
    setCreateError('');
    setCustomer(null);
    setFreeRooms([]);
    setSelectedRoom(null);
    setGroupSize(1);
    setMembers([]);
    setSubmitError('');
    setSuccess(false);
  }

  if (success) {
    return (
      <div className="page">
        <div className="checkin-success">
          <div className="checkin-success-icon">&#10003;</div>
          <h2>Checked In</h2>
          <p>
            {customer.name}
            {groupSize > 1 ? ` + ${groupSize - 1} guest${groupSize - 1 > 1 ? 's' : ''}` : ''}
            {' '}now in <strong>{selectedRoom.name}</strong>.
          </p>
          <button className="btn btn-primary" onClick={reset}>
            New Check-In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Check In</h1>
      </div>

      {/* Step 1 — Find Customer */}
      <div className="checkin-step">
        <h2 className="section-title">
          <span className="step-badge">1</span>
          Find Customer
          {customer && (
            <span className="customer-chip">
              {customer.name}
              <button className="btn-link" onClick={clearCustomer}>
                Change
              </button>
            </span>
          )}
        </h2>

        {!customer && (
          <>
            <div className="search-row">
              <input
                className="form-input"
                type="text"
                placeholder="Search by name or phone..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                className="btn btn-primary"
                onClick={handleSearch}
                disabled={searching || !phone.trim()}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchError && <p className="error-text">{searchError}</p>}

            {searched && results.length > 0 && (
              <div className="customer-results">
                {results.map((c) => (
                  <button
                    key={c.id}
                    className="customer-result-btn"
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="result-name">{c.name}</span>
                    <span className="result-phone">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}

            {searched && results.length === 0 && (
              <div className="not-found-box">
                <p>No customer found. Create a new record:</p>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label">Full name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Customer's name..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone number</label>
                  <input
                    className="form-input"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone number..."
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                {createError && <p className="error-text">{createError}</p>}
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={creating || !newName.trim() || !newPhone.trim()}
                  style={{ marginTop: '12px' }}
                >
                  {creating ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 2 — Select Room */}
      {customer && (
        <div className="checkin-step">
          <h2 className="section-title">
            <span className="step-badge">2</span>
            Select Room
          </h2>

          {loadingRooms && <Spinner />}
          {roomsError  && <p className="error-text">{roomsError}</p>}
          {!loadingRooms && !roomsError && freeRooms.length === 0 && (
            <p className="empty-text">No rooms available right now.</p>
          )}

          {!loadingRooms && freeRooms.length > 0 && (
            <div className="room-grid">
              {freeRooms.map((r) => (
                <button
                  key={r.id}
                  className={
                    'room-card' +
                    (selectedRoom?.id === r.id ? ' room-card--selected' : '')
                  }
                  onClick={() => setSelectedRoom(r)}
                >
                  <span className="room-card-name">{r.name}</span>
                  <span className="room-card-type">{r.type_name}</span>
                  <span className="room-card-price">
                    EGP {parseFloat(r.hourly_rate).toFixed(0)}/hr
                  </span>
                  <span className="room-card-free">
                    {r.free_places} of {r.max_capacity} seats free
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Group Size + Members + Submit */}
      {customer && selectedRoom && (
        <div className="checkin-step">
          <h2 className="section-title">
            <span className="step-badge">3</span>
            Group Details
          </h2>

          <div className="group-size-row">
            <label className="form-label">People (incl. {customer.name.split(' ')[0]}):</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={selectedRoom.free_places}
              value={groupSize}
              onChange={(e) => handleGroupSizeChange(e.target.value)}
              style={{ width: '80px' }}
            />
            <span className="capacity-hint">
              {selectedRoom.free_places} of {selectedRoom.max_capacity} seats free in {selectedRoom.name}
            </span>
          </div>

          {members.length > 0 && (
            <div className="members-section">
              <p className="members-hint">
                Enter details for the other {members.length} guest
                {members.length > 1 ? 's' : ''}:
              </p>
              {members.map((m, i) => (
                <MemberInput
                  key={i}
                  index={i}
                  member={m}
                  onChange={(next) => updateMemberRow(i, next)}
                />
              ))}
            </div>
          )}

          {submitError && <p className="error-text">{submitError}</p>}

          <button
            className="btn btn-primary btn-lg"
            onClick={handleCheckIn}
            disabled={submitting || !membersComplete}
            style={{ marginTop: '16px' }}
          >
            {submitting ? 'Checking In...' : `Check In ${customer.name}`}
          </button>
        </div>
      )}
    </div>
  );
}
