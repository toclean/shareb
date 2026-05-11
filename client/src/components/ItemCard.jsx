import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';
const TYPE_CONFIG = {
  image:  { icon: '🖼️',  label: 'Photo',   color: 'bg-blue-100 text-blue-700' },
  video:  { icon: '🎬',  label: 'Video',   color: 'bg-purple-100 text-purple-700' },
  music:  { icon: '🎵',  label: 'Music',   color: 'bg-pink-100 text-pink-700' },
  link:   { icon: '🔗',  label: 'Link',    color: 'bg-green-100 text-green-700' },
  amazon: { icon: '🛍️',  label: 'Shop',    color: 'bg-orange-100 text-orange-700' },
  note:   { icon: '📝',  label: 'Note',    color: 'bg-yellow-100 text-yellow-700' },
  file:   { icon: '📄',  label: 'File',    color: 'bg-gray-100 text-gray-700' },
};

function getRetailerConfig(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (hostname.includes('amazon.'))   return { icon: '📦', label: 'Amazon' };
    if (hostname.includes('walmart.'))  return { icon: '🛒', label: 'Walmart' };
    if (hostname.includes('target.'))   return { icon: '🎯', label: 'Target' };
    if (hostname.includes('bestbuy.'))  return { icon: '💻', label: 'Best Buy' };
    if (hostname.includes('etsy.'))     return { icon: '🎨', label: 'Etsy' };
    if (hostname.includes('ebay.'))     return { icon: '🏷️', label: 'eBay' };
  } catch { /* ignore */ }
  return null;
}

const REACTIONS = ['❤️', '😍', '😂', '🔥', '👀', '🐝', '⭐'];

export default function ItemCard({ item: initialItem, onDelete, onReact, onFavorite }) {
  const { user } = useAuth();
  const [showReactions, setShowReactions] = useState(false);
  const [item, setItem] = useState(initialItem);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.file;
  const retailer = item.type === 'amazon' && item.content ? getRetailerConfig(item.content) : null;
  const displayCfg = retailer ? { ...cfg, icon: retailer.icon, label: retailer.label } : cfg;

  // Route external thumbnails through our server proxy to avoid hotlink blocking
  const thumbnailSrc = item.thumbnail
    ? (item.thumbnail.startsWith('/uploads/')
        ? item.thumbnail
        : `/api/imgproxy?url=${encodeURIComponent(item.thumbnail)}`)
    : null;

  async function handleRefreshPreview() {
    if (!item.content) return;
    setFetchingPreview(true);
    try {
      const previewRes = await api.get('/items/link-preview', { params: { url: item.content } });
      const { thumbnail, price, title } = previewRes.data;
      if (!thumbnail && !price) {
        toast('No preview found for that URL 🤷');
        return;
      }
      const metaRes = await api.put(`/items/${item.id}/meta`, { thumbnail, price, title: item.title ? undefined : title });
      setItem(metaRes.data.item);
      toast.success('Preview updated! 🐝');
    } catch {
      toast.error('Could not fetch preview');
    } finally {
      setFetchingPreview(false);
    }
  }

  async function handleFavorite() {
    try {
      const res = await api.put(`/items/${item.id}/favorite`);
      onFavorite?.(item.id, res.data.is_favorite);
    } catch {
      toast.error('Could not update');
    }
  }

  async function handleReact(emoji) {
    try {
      await api.post(`/items/${item.id}/react`, { emoji });
      onReact?.(item.id, emoji);
      setShowReactions(false);
    } catch {
      toast.error('Could not react');
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/items/${item.id}`);
      onDelete?.(item.id);
      toast.success('Deleted');
    } catch {
      toast.error('Could not delete');
    }
  }

  const isMediaFile = ['image', 'video', 'music'].includes(item.type) && item.file_path;
  const mediaUrl = item.file_path ? `/uploads/${item.file_path}` : null;

  return (
    <div className="card group hover:shadow-md transition-shadow duration-200">
      {/* Media Preview */}
      {item.type === 'amazon' && thumbnailSrc && (
        <div className="bg-white border-b border-honey-50 flex justify-center p-4">
          <img
            src={thumbnailSrc}
            alt={item.title || 'Product'}
            className="h-40 max-w-[200px] object-contain"
            loading="lazy"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}

      {item.type === 'link' && thumbnailSrc && (
        <div className="aspect-video bg-gray-50 overflow-hidden">
          <img
            src={thumbnailSrc}
            alt={item.title || 'Link preview'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}

      {item.type === 'image' && mediaUrl && (
        <div className="aspect-video bg-gray-100 overflow-hidden">
          <img
            src={mediaUrl}
            alt={item.title || 'Image'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {item.type === 'video' && mediaUrl && (
        <div className="aspect-video bg-black">
          <video
            src={mediaUrl}
            controls
            className="w-full h-full"
            preload="metadata"
          />
        </div>
      )}

      {item.type === 'music' && mediaUrl && (
        <div className="bg-gradient-to-r from-pink-100 to-purple-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎵</span>
            <audio src={mediaUrl} controls className="flex-1 h-8" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="hex-avatar w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold text-bee-black"
              style={{ backgroundColor: item.avatar_color || '#F5C518' }}
            >
              {item.display_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-gray-600 block truncate">
                {item.display_name}
                {item.is_mine && <span className="text-honey-500 ml-1">(you)</span>}
              </span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <span className={`type-badge ${cfg.color} flex-shrink-0`}>
            {displayCfg.icon} {displayCfg.label}
          </span>
        </div>

        {/* Title */}
        {item.title && (
          <h3 className="font-semibold text-bee-black mb-1 leading-snug">{item.title}</h3>
        )}

        {/* Content / Link */}
        {item.content && (
          <div className="mb-2">
            {item.type === 'note' ? (
              <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
            ) : (
              <a
                href={item.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-honey-600 hover:text-honey-700 text-sm break-all underline decoration-dotted"
              >
                {item.content}
              </a>
            )}
          </div>
        )}

        {/* Price badge (Amazon) */}
        {item.price && (
          <div className="inline-flex items-center gap-1 bg-honey-100 text-honey-800 font-bold text-sm px-3 py-1 rounded-full mb-2">
            🏷️ {item.price}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-gray-500 italic mt-1">{item.notes}</p>
        )}

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.map(tag => (
              <span key={tag} className="text-xs bg-honey-100 text-honey-700 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-honey-50">
          {/* Reaction display */}
          {item.my_reaction && (
            <span className="text-lg">{item.my_reaction}</span>
          )}

          {/* React button */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="btn-ghost text-sm px-2 py-1 text-gray-500"
            >
              {item.my_reaction ? '😊' : '🫶'} React
            </button>
            {showReactions && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-honey-200 rounded-xl shadow-lg p-2 flex gap-1 z-10">
                {REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="text-xl hover:scale-125 transition-transform p-0.5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Favorite */}
          <button
            onClick={handleFavorite}
            className={`btn-ghost text-sm px-2 py-1 ${item.is_favorite ? 'text-honey-500' : 'text-gray-400'}`}
          >
            {item.is_favorite ? '⭐' : '☆'} Fav
          </button>

          {/* Delete (only own items) */}
          {item.is_mine && (
            <button
              onClick={handleDelete}
              className="ml-auto text-gray-300 hover:text-red-400 text-sm px-2 py-1 transition-colors opacity-0 group-hover:opacity-100"
            >
              🗑️
            </button>
          )}

          {/* Refresh preview for amazon/link items missing a thumbnail */}
          {['amazon', 'link'].includes(item.type) && !thumbnailSrc && item.content && (
            <button
              onClick={handleRefreshPreview}
              disabled={fetchingPreview}
              className="ml-auto text-gray-300 hover:text-honey-500 text-xs px-2 py-1 transition-colors"
              title="Fetch thumbnail"
            >
              {fetchingPreview ? '⏳' : '🖼️ Get preview'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
