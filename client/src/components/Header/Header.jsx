import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./header.scss";

const Header = ({ title, profile, onLogout }) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = useMemo(() => {
    if (!profile) {
      return "U";
    }

    return `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();
  }, [profile]);

  const roleLabel = String(profile?.type) === "1" ? "Client" : "Consultant";

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__eyebrow">Consulting Sessions</span>
        <h1 className="header__title">{title}</h1>
      </div>

      <nav className="header__nav" aria-label="Primary">
        <Link
          className={`header__nav-link ${location.pathname === "/dashboard" ? "header__nav-link--active" : ""}`}
          to="/dashboard"
        >
          Dashboard
        </Link>
      </nav>

      <div className="header__profile-shell">
        <button
          className={`header__profile-trigger ${menuOpen ? "header__profile-trigger--open" : ""}`}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className="header__avatar">{initials}</span>
          <span className="header__profile-copy">
            <strong>{profile?.first_name} {profile?.last_name}</strong>
            <small>{roleLabel}</small>
          </span>
        </button>

        {menuOpen ? (
          <div className="header__menu">
            <Link className="header__menu-link" to="/profile/edit" onClick={() => setMenuOpen(false)}>
              Edit profile
            </Link>
            <button className="header__menu-link header__menu-link--danger" onClick={onLogout}>
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

Header.defaultProps = {
  title: "Default Header Title",
  profile: null,
};

export default Header;
