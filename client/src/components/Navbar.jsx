import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, partner, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="sticky top-0 z-50 bg-bee-black text-white shadow-lg">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 font-black text-honey-500 text-lg">
          <span className="text-2xl">🐝</span>
          <span>ShareB</span>
        </NavLink>

        {/* Nav links */}
        <div className="flex items-center gap-1 ml-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-honey-500 text-bee-black' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`
            }
          >
            🏠 Feed
          </NavLink>
          <NavLink
            to="/shopping"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-honey-500 text-bee-black' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`
            }
          >
            🛒 Shopping
          </NavLink>
          <NavLink
            to="/passwords"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-honey-500 text-bee-black' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`
            }
          >
            🔐 Vault
          </NavLink>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Partner indicator */}
        {partner && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>{partner.display_name}</span>
          </div>
        )}

        {/* User avatar + logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="hex-avatar w-8 h-8 flex items-center justify-center text-bee-black text-sm font-bold"
              style={{ backgroundColor: user?.avatar_color || '#F5C518' }}
            >
              {user?.display_name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.display_name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm transition-colors px-2 py-1 rounded hover:bg-white/10"
          >
            Exit
          </button>
        </div>
      </div>
    </nav>
  );
}
