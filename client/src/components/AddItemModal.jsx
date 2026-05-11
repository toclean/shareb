import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api/client';
import toast from 'react-hot-toast';

const LINK_TYPES = [
  { value: 'link', label: '🔗 Link', placeholder: 'https://...' },
  { value: 'amazon', label: '🛍️ Shop', placeholder: 'https://amazon.com/...' },
];

function detectRetailerPlaceholder(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (hostname.includes('amazon.')) return 'https://amazon.com/dp/...';
    if (hostname.includes('walmart.com')) return 'https://walmart.com/ip/...';
    if (hostname.includes('target.com')) return 'https://target.com/p/...';
    if (hostname.includes('bestbuy.com')) return 'https://bestbuy.com/site/...';
    if (hostname.includes('etsy.com')) return 'https://etsy.com/listing/...';
  } catch { /* ignore */ }
  return 'https://amazon.com/... or walmart.com/... or target.com/...';
}

export default function AddItemModal({ onClose, onAdd }) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'link' | 'note'
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ type: 'link', title: '', content: '', notes: '', tags: '', price: '' });
  const [preview, setPreview] = useState({ thumbnail: null, loading: false });
  const previewTimeoutRef = useRef(null);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    accept: {
      'image/*': [],
      'video/*': [],
      'audio/*': [],
    }
  });

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    setLoading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      if (form.title) data.append('title', form.title);
      if (form.notes) data.append('notes', form.notes);
      if (form.tags) data.append('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)));

      const res = await api.post('/items/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onAdd(res.data.item);
      toast.success('Shared! 🐝');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLink(e) {
    e.preventDefault();
    if (!form.content) return toast.error('URL required');
    setLoading(true);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await api.post('/items', {
        type: form.type,
        title: form.title || undefined,
        content: form.content,
        notes: form.notes || undefined,
        thumbnail: preview.thumbnail || undefined,
        price: form.price || undefined,
        tags
      });
      onAdd(res.data.item);
      toast.success('Shared! 🐝');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to share');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPreview(url) {
    if (!url) return;
    try { new URL(url); } catch { return; }
    setPreview({ thumbnail: null, loading: true });
    try {
      const res = await api.get('/items/link-preview', { params: { url } });
      const { thumbnail, title, price } = res.data;
      setPreview({ thumbnail: thumbnail || null, loading: false });
      if (title && !form.title) setForm(f => ({ ...f, title }));
      if (price && !form.price) setForm(f => ({ ...f, price }));
    } catch {
      setPreview({ thumbnail: null, loading: false });
    }
  }

  function handleUrlChange(e) {
    const url = e.target.value;
    setForm(f => ({ ...f, content: url }));
    // Debounce preview fetch
    clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = setTimeout(() => fetchPreview(url), 600);
  }

  async function handleNote(e) {
    e.preventDefault();
    if (!form.content && !form.title) return toast.error('Write something first');
    setLoading(true);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await api.post('/items', {
        type: 'note',
        title: form.title || undefined,
        content: form.content,
        notes: form.notes || undefined,
        tags
      });
      onAdd(res.data.item);
      toast.success('Note shared! 🍯');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to share');
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'upload', label: '📤 Upload' },
    { id: 'link', label: '🔗 Link' },
    { id: 'note', label: '📝 Note' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg modal-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-honey-100">
          <h2 className="font-bold text-lg">Share something 🐝</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-honey-100">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-bee-black border-b-2 border-honey-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* UPLOAD TAB */}
          {tab === 'upload' && (
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-honey-500 bg-honey-50' : 'border-honey-200 hover:border-honey-400'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div>
                    <div className="text-3xl mb-1">
                      {file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : '🎵'}
                    </div>
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-red-400 hover:text-red-600 mt-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">📤</p>
                    <p className="text-sm text-gray-500">Drop a photo, video, or song here</p>
                    <p className="text-xs text-gray-400 mt-1">or click to browse • max 100MB</p>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Title (optional)</label>
                <input className="input" placeholder="Give it a name..." value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input className="input" placeholder="cute, funny, music..." value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
              </div>
              <button className="btn-primary w-full py-3" disabled={loading || !file}>
                {loading ? 'Uploading...' : 'Share 🐝'}
              </button>
            </form>
          )}

          {/* LINK TAB */}
          {tab === 'link' && (
            <form onSubmit={handleLink} className="space-y-4">
              <div className="flex gap-2">
                {LINK_TYPES.map(lt => (
                  <button
                    key={lt.value}
                    type="button"
                    onClick={() => { setForm(f => ({...f, type: lt.value})); setPreview({ thumbnail: null, loading: false }); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      form.type === lt.value
                        ? 'bg-honey-500 border-honey-500 text-bee-black'
                        : 'border-honey-200 text-gray-500 hover:border-honey-400'
                    }`}
                  >
                    {lt.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">URL</label>
                <input
                  className="input"
                  type="url"
                  placeholder={form.type === 'amazon'
                    ? detectRetailerPlaceholder(form.content)
                    : LINK_TYPES.find(l => l.value === form.type)?.placeholder}
                  value={form.content}
                  onChange={handleUrlChange}
                  required
                />
              </div>

              {/* Thumbnail preview */}
              {preview.loading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="animate-spin inline-block">🐝</span> Fetching preview...
                </div>
              )}
              {preview.thumbnail && !preview.loading && (
                <div className="flex items-start gap-3 bg-honey-50 rounded-xl p-3 border border-honey-200">
                  <img
                    src={`/api/imgproxy?url=${encodeURIComponent(preview.thumbnail)}`}
                    alt="Preview"
                    className="w-20 h-20 object-contain rounded-lg bg-white border border-honey-100 flex-shrink-0"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Preview</p>
                    {form.title && <p className="text-sm font-medium truncate">{form.title}</p>}
                    {form.price && <p className="text-sm font-bold text-honey-600">{form.price}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreview({ thumbnail: null, loading: false })}
                    className="text-gray-300 hover:text-gray-500 text-lg leading-none"
                  >×</button>
                </div>
              )}

              <div>
                <label className="label">Title (optional)</label>
                <input className="input" placeholder="What is this?" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
              </div>
              {form.type === 'amazon' && (
                <div>
                  <label className="label">Price (optional)</label>
                  <input className="input" placeholder="$29.99" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} />
                </div>
              )}
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" placeholder="Why are you sharing this?" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input className="input" placeholder="shopping, wishlist..." value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
              </div>
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Sharing...' : 'Share 🔗'}
              </button>
            </form>
          )}

          {/* NOTE TAB */}
          {tab === 'note' && (
            <form onSubmit={handleNote} className="space-y-4">
              <div>
                <label className="label">Title (optional)</label>
                <input className="input" placeholder="Subject..." value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input resize-none"
                  rows={5}
                  placeholder="Write something sweet... 🍯"
                  value={form.content}
                  onChange={e => setForm(f => ({...f, content: e.target.value}))}
                />
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input className="input" placeholder="reminder, idea..." value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
              </div>
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Sharing...' : 'Share Note 📝'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
