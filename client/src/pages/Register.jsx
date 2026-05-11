import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Register() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', display_name: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user);
      toast.success(`Welcome to ShareB, ${res.data.user.display_name}! 🐝`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen honeycomb-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3 animate-float inline-block">🐝</div>
          <h1 className="text-4xl font-black text-bee-black tracking-tight">ShareB</h1>
          <p className="text-gray-500 mt-1">Join the hive 🍯</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-bold mb-2 text-center">Create account</h2>
          <p className="text-xs text-gray-400 text-center mb-6">Only 2 bees allowed per hive</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Display Name</label>
              <input
                className="input"
                placeholder="What should we call you?"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                required
                maxLength={30}
              />
            </div>
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="your username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g,'') }))}
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="at least 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button className="btn-primary w-full py-3 text-base mt-2" disabled={loading}>
              {loading ? 'Creating hive...' : 'Join the Hive 🐝'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already a bee?{' '}
            <Link to="/login" className="text-honey-600 font-semibold hover:text-honey-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
