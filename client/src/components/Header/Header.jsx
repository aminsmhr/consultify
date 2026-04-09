import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./header.scss";

const Header = ({ profile, onLogout }) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = useMemo(() => {
    if (!profile) {
      return "U";
    }

    return `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  }, [profile]);

  const roleLabel = String(profile?.type) === "1" ? "Client workspace" : "Consultant workspace";

  const navItems = [
    { to: "/dashboard", label: "Home" },
    { to: "/profile/edit", label: "Profile" },
  ];

  return (
    <aside className="workspace-nav">
      <div className="workspace-nav__brand">
        <div className="workspace-nav__logo">C</div>
        <div>
          <strong>Consultify</strong>
          <span>Collaboration hub</span>
        </div>
      </div>

      <div className="workspace-nav__search">
        <input type="text" value="Search workspace" readOnly aria-label="Search workspace" />
      </div>

      <nav className="workspace-nav__links" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to === "/dashboard" && location.pathname === "/appointment");

          return (
            <Link
              key={item.to}
              className={`workspace-nav__link ${isActive ? "workspace-nav__link--active" : ""}`}
              to={item.to}
            >
              <span className="workspace-nav__link-indicator"></span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="workspace-nav__section">
        <p className="workspace-nav__section-title">Workspace</p>
        <div className="workspace-nav__promo">
          <strong>Shared operations</strong>
          <p>Appointments, messages, and live calls now follow one consistent layout.</p>
        </div>
      </div>

      <div className="workspace-nav__profile-shell">
        <button
          className={`workspace-nav__profile-trigger ${menuOpen ? "workspace-nav__profile-trigger--open" : ""}`}
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <span className="workspace-nav__avatar">{initials}</span>
          <span className="workspace-nav__profile-copy">
            <strong>{profile?.first_name} {profile?.last_name}</strong>
            <small>{roleLabel}</small>
          </span>
        </button>

        {menuOpen ? (
          <div className="workspace-nav__menu">
            <Link className="workspace-nav__menu-link" to="/profile/edit" onClick={() => setMenuOpen(false)}>
              Manage profile
            </Link>
            <button className="workspace-nav__menu-link workspace-nav__menu-link--danger" onClick={onLogout} type="button">
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

Header.defaultProps = {
  profile: null,
};

export default Header;
