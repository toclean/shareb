import { useState, useEffect } from 'react';
import api from '../api/client';
import ItemCard from '../components/ItemCard';
import AddItemModal from '../components/AddItemModal';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const FILTERS = [
  { value: '', label: 'All 🐝' },
  { value: 'image', label: '🖼️ Photos' },
  { value: 'video', label: '🎬 Videos' },
  { value: 'music', label: '🎵 Music' },
  { value: 'link', label: '🔗 Links' },
  { value: 'amazon', label: '📦 Amazon' },
  { value: 'note', label: '📝 Notes' },
];

export default function Dashboard() {
  const { user, partner } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await api.get('/items', { params: filter ? { type: filter } : {} });
      setItems(res.data.items);
    } catch {
      toast.error('Could not load feed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchItems(); }, [filter]);

  function handleAdd(item) {
    setItems(prev => [item, ...prev]);
  }

  function handleDelete(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handleReact(id, emoji) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, my_reaction: emoji } : i));
  }

  function handleFavorite(id, isFav) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: isFav } : i));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-10">
      {/* Partner banner if no partner yet */}
      {!partner && (
        <div className="mt-6 bg-honey-100 border border-honey-300 rounded-2xl p-4 text-center">
          <p className="text-sm font-medium text-honey-800">🐝 Invite your partner to join! Have them register with a new account.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <div>
          <h1 className="text-2xl font-black text-bee-black">
            {partner
              ? `${user.display_name} & ${partner.display_name} 🐝`
              : `${user.display_name}'s Hive 🐝`}
          </h1>
          <p className="text-sm text-gray-500">Your shared feed</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-bee-black text-honey-500'
                : 'bg-white border border-honey-200 text-gray-600 hover:border-honey-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="text-center py-20">
          <div className="text-5xl animate-bounce">🐝</div>
          <p className="text-gray-400 mt-3">Loading the hive...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-3">🍯</div>
          <p className="font-semibold text-gray-500">Nothing here yet!</p>
          <p className="text-sm text-gray-400 mt-1">Be the first bee to share something</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary mt-4"
          >
            Share something 🐝
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onReact={handleReact}
              onFavorite={handleFavorite}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
