import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/',        label: 'Active Visits', end: true },
  { to: '/check-in', label: 'Check In' },
  { to: '/customers', label: 'Customers' },
  { to: '/rooms',   label: 'Rooms' },
  { to: '/reports', label: 'Reports' },
  { to: '/history', label: 'History' },
];

export default function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>Axis</span>WorkSpace
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'sidebar-link' + (isActive ? ' sidebar-link--active' : '')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
