import { NavLink } from 'react-router-dom';

export default function BottomNav() {
  const linkClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-honey-400' : 'text-gray-400 active:text-white'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bee-black border-t border-white/10 md:hidden safe-bottom">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        <NavLink to="/" end className={linkClass}>
          <span className="text-xl">🏠</span>
          <span>Feed</span>
        </NavLink>
        <NavLink to="/shopping" className={linkClass}>
          <span className="text-xl">🛒</span>
          <span>Shopping</span>
        </NavLink>
        <NavLink to="/passwords" className={linkClass}>
          <span className="text-xl">🔐</span>
          <span>Vault</span>
        </NavLink>
      </div>
    </nav>
  );
}
