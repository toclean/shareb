import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Passwords() {
  const { user } = useAuth();
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);

  async function fetchPasswords() {
    setLoading(true);
    try {
      const res = await api.get('/passwords');
      setPasswords(res.data.passwords);
    } catch {
      toast.error('Could not load vault');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPasswords(); }, []);

  function handleAdd(pw) {
    setPasswords(prev => [pw, ...prev]);
    setShowAdd(false);
  }

  function handleEdit(pw) {
    setPasswords(prev => prev.map(p => p.id === pw.id ? pw : p));
    setEditItem(null);
  }

  async function handleDelete(id) {
    const pw = passwords.find(p => p.id === id);
    if (!pw) return;
    if (pw.added_by !== user.id) return toast.error('You can only delete your own entries');
    if (!confirm('Delete this password?')) return;
    setPasswords(prev => prev.filter(p => p.id !== id));
    try {
      await api.delete(`/passwords/${id}`);
      toast.success('Deleted');
    } catch {
      toast.error('Could not delete');
      fetchPasswords();
    }
  }

  const filtered = passwords.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.website?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 pb-28">
      <div className="flex items-center justify-between mt-6 mb-4">
        <div>
          <h1 className="text-2xl font-black text-bee-black">Password Vault 🔐</h1>
          <p className="text-sm text-gray-500">Shared securely between you two</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          + Add
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="input"
          placeholder="🔍 Search passwords..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="text-5xl animate-bounce">🔐</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-3">🔒</div>
          <p className="text-gray-500 font-medium">No passwords saved yet</p>
          <p className="text-sm text-gray-400 mt-1">Keep your shared logins safe here</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">
            Add first password
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pw => (
            <PasswordCard
              key={pw.id}
              pw={pw}
              isOwner={pw.added_by === user.id}
              onEdit={() => setEditItem(pw)}
              onDelete={() => handleDelete(pw.id)}
            />
          ))}
        </div>
      )}

      {(showAdd || editItem) && (
        <PasswordModal
          initial={editItem}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          onSave={editItem ? handleEdit : handleAdd}
        />
      )}
    </div>
  );
}

function PasswordCard({ pw, isOwner, onEdit, onDelete }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState('');

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
      toast.success(`${label} copied!`);
    });
  }

  return (
    <div className="card p-4 group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-honey-100 flex items-center justify-center text-xl flex-shrink-0">
            {pw.website ? '🌐' : '🔑'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-bee-black truncate">{pw.title}</h3>
            {pw.website && (
              <a
                href={pw.website.startsWith('http') ? pw.website : `https://${pw.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-honey-600 hover:underline truncate block"
              >
                {pw.website}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwner && (
            <>
              <button onClick={onEdit} className="btn-ghost text-xs px-2 py-1">✏️</button>
              <button onClick={onDelete} className="btn-danger text-xs px-2 py-1">🗑️</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {pw.username_val && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 flex-shrink-0">Username</span>
            <code className="text-sm bg-honey-50 px-2 py-0.5 rounded flex-1 truncate">{pw.username_val}</code>
            <button
              onClick={() => copyToClipboard(pw.username_val, 'Username')}
              className="text-xs text-gray-400 hover:text-honey-600 flex-shrink-0"
            >
              {copied === 'Username' ? '✓' : '📋'}
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-16 flex-shrink-0">Password</span>
          <code className="text-sm bg-honey-50 px-2 py-0.5 rounded flex-1 truncate font-mono">
            {showPassword ? pw.password_plain : '••••••••••••'}
          </code>
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="text-xs text-gray-400 hover:text-honey-600 flex-shrink-0"
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
          <button
            onClick={() => copyToClipboard(pw.password_plain, 'Password')}
            className="text-xs text-gray-400 hover:text-honey-600 flex-shrink-0"
          >
            {copied === 'Password' ? '✓' : '📋'}
          </button>
        </div>
      </div>

      {pw.notes && (
        <p className="text-xs text-gray-400 mt-2 italic">{pw.notes}</p>
      )}

      <div className="flex items-center gap-1 mt-2">
        <div
          className="hex-avatar w-4 h-4 inline-flex items-center justify-center text-[9px] font-bold text-bee-black"
          style={{ backgroundColor: pw.avatar_color || '#F5C518' }}
        />
        <span className="text-xs text-gray-400">{pw.display_name}</span>
      </div>
    </div>
  );
}

function PasswordModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    username_val: initial?.username_val || '',
    password: initial ? '' : '',
    website: initial?.website || '',
    notes: initial?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pwd = '';
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    arr.forEach(b => { pwd += chars[b % chars.length]; });
    setForm(f => ({...f, password: pwd}));
    setShowPassword(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (initial) {
        res = await api.put(`/passwords/${initial.id}`, form);
        onSave(res.data.password);
        toast.success('Updated!');
      } else {
        if (!form.password) return toast.error('Password required');
        res = await api.post('/passwords', form);
        onSave(res.data.password);
        toast.success('Saved to vault 🔐');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md modal-enter" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-honey-100">
          <h2 className="font-bold text-lg">{initial ? 'Edit Password' : 'Add Password'} 🔐</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="Netflix, WiFi, etc." value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Username / Email</label>
            <input className="input" placeholder="user@email.com" value={form.username_val} onChange={e => setForm(f => ({...f, username_val: e.target.value}))} autoComplete="off" />
          </div>
          <div>
            <label className="label">Password {initial ? '(leave blank to keep)' : '*'}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={initial ? 'Enter new password to change' : '••••••••'}
                  value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  required={!initial}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <button type="button" onClick={generatePassword} className="btn-secondary text-sm px-3">
                🎲 Gen
              </button>
            </div>
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" placeholder="netflix.com" value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Any extra info..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <button className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Saving...' : initial ? 'Save Changes' : 'Add to Vault 🔐'}
          </button>
        </form>
      </div>
    </div>
  );
}
