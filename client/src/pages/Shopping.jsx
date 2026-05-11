import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['General', 'Groceries', 'Household', 'Personal', 'Electronics', 'Other'];

export default function Shopping() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', quantity: '', category: 'General' });
  const [adding, setAdding] = useState(false);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await api.get('/shopping');
      setItems(res.data.items);
    } catch {
      toast.error('Could not load list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchItems(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setAdding(true);
    try {
      const res = await api.post('/shopping', form);
      setItems(prev => [res.data.item, ...prev]);
      setForm({ name: '', quantity: '', category: 'General' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add item');
    } finally {
      setAdding(false);
    }
  }

  async function handleCheck(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setItems(prev => prev.map(i => i.id === id ? {...i, checked: !i.checked} : i));
    try {
      await api.put(`/shopping/${id}/check`);
    } catch {
      setItems(prev => prev.map(i => i.id === id ? {...i, checked: item.checked} : i));
      toast.error('Could not update');
    }
  }

  async function handleDelete(id) {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await api.delete(`/shopping/${id}`);
    } catch {
      toast.error('Could not delete');
      fetchItems();
    }
  }

  async function clearChecked() {
    if (!confirm('Remove all checked items?')) return;
    setItems(prev => prev.filter(i => !i.checked));
    try {
      await api.delete('/shopping/checked/all');
    } catch {
      toast.error('Could not clear');
      fetchItems();
    }
  }

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  // Group unchecked by category
  const grouped = unchecked.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto px-4 pb-10">
      <div className="mt-6 mb-6">
        <h1 className="text-2xl font-black text-bee-black">Shopping List 🛒</h1>
        <p className="text-sm text-gray-500">{unchecked.length} item{unchecked.length !== 1 ? 's' : ''} to get</p>
      </div>

      {/* Add form */}
      <div className="card p-4 mb-6">
        <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-40"
            placeholder="Add an item..."
            value={form.name}
            onChange={e => setForm(f => ({...f, name: e.target.value}))}
            required
          />
          <input
            className="input w-20"
            placeholder="Qty"
            value={form.quantity}
            onChange={e => setForm(f => ({...f, quantity: e.target.value}))}
          />
          <select
            className="input w-32"
            value={form.category}
            onChange={e => setForm(f => ({...f, category: e.target.value}))}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="btn-primary" disabled={adding}>
            {adding ? '...' : '+ Add'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="text-5xl animate-bounce">🐝</div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-3">🛒</div>
          <p className="text-gray-500 font-medium">List is empty!</p>
          <p className="text-sm text-gray-400 mt-1">Add your first item above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Grouped unchecked */}
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="card overflow-visible">
              <div className="px-4 py-2 border-b border-honey-50 flex items-center gap-2">
                <span className="text-xs font-semibold text-honey-700 uppercase tracking-wider">{category}</span>
                <span className="text-xs text-gray-400">({catItems.length})</span>
              </div>
              <ul className="divide-y divide-honey-50">
                {catItems.map(item => (
                  <ShoppingItem
                    key={item.id}
                    item={item}
                    currentUserId={user.id}
                    onCheck={handleCheck}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </div>
          ))}

          {/* Checked items */}
          {checked.length > 0 && (
            <div className="card opacity-60">
              <div className="px-4 py-2 border-b border-honey-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  ✓ Got it ({checked.length})
                </span>
                <button onClick={clearChecked} className="text-xs text-red-400 hover:text-red-600">
                  Clear all
                </button>
              </div>
              <ul className="divide-y divide-honey-50">
                {checked.map(item => (
                  <ShoppingItem
                    key={item.id}
                    item={item}
                    currentUserId={user.id}
                    onCheck={handleCheck}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShoppingItem({ item, currentUserId, onCheck, onDelete }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 group hover:bg-honey-50 transition-colors">
      <button
        onClick={() => onCheck(item.id)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors flex items-center justify-center ${
          item.checked ? 'bg-honey-500 border-honey-500' : 'border-gray-300 hover:border-honey-400'
        }`}
      >
        {item.checked && <span className="text-xs text-bee-black font-bold">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-bee-black'}`}>
          {item.name}
        </span>
        {item.quantity && item.quantity !== '1' && (
          <span className="text-xs text-gray-400 ml-2">×{item.quantity}</span>
        )}
      </div>

      <div
        className="hex-avatar w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs font-bold text-bee-black"
        style={{ backgroundColor: item.avatar_color || '#F5C518' }}
        title={item.display_name}
      >
        {item.display_name?.[0]?.toUpperCase()}
      </div>

      <button
        onClick={() => onDelete(item.id)}
        className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm ml-1"
      >
        ×
      </button>
    </li>
  );
}
