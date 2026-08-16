import { useState, useEffect, useRef } from 'react';
import { searchCustomers } from '../api';

// One group-member row: name + phone inputs with a live suggestions dropdown.
// Typing either field searches existing customers; picking one fills both and
// tags them as an existing customer. Typing manually marks them as new (to be
// created on check-in). Phone is digits-only.
export default function MemberInput({ index, member, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  // Debounced search whenever the user types a name/phone fragment.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await searchCustomers(term);
        setSuggestions(res.data);
        setOpen(res.data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown when clicking outside this row.
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function setName(v) {
    onChange({ ...member, name: v, customer_id: null });
    setQuery(v);
  }
  function setPhone(v) {
    const digits = v.replace(/\D/g, '');
    onChange({ ...member, phone: digits, customer_id: null });
    setQuery(digits);
  }
  function pick(c) {
    onChange({ name: c.name, phone: c.phone, customer_id: c.id });
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="member-row" ref={boxRef}>
      <span className="member-num">{index + 2}</span>
      <div className="member-fields">
        <input
          className="form-input"
          type="text"
          placeholder="Name"
          value={member.name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="form-input"
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          value={member.phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {member.customer_id && (
          <span className="member-known" title="Existing customer">✓</span>
        )}
        {open && (
          <div className="autocomplete">
            {suggestions.map((c) => (
              <button
                type="button"
                key={c.id}
                className="autocomplete-item"
                onClick={() => pick(c)}
              >
                <span className="result-name">{c.name}</span>
                <span className="result-phone">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
