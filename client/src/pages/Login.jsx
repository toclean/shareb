import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.display_name}! 🐝`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen honeycomb-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-3 animate-float inline-block">🐝</div>
          <h1 className="text-4xl font-black text-bee-black tracking-tight">ShareB</h1>
          <p className="text-gray-500 mt-1">Your little honey vault 🍯</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6 text-center">Welcome back!</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="your username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <button className="btn-primary w-full py-3 text-base mt-2" disabled={loading}>
              {loading ? 'Buzzing in...' : 'Sign In 🐝'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            New bee?{' '}
            <Link to="/register" className="text-honey-600 font-semibold hover:text-honey-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
