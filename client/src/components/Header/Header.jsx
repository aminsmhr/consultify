import React from "react";
import './header.scss'; 


const Header = ({ title }) => {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__eyebrow">Consulting Sessions</span>
        <h1 className="header__title">{title}</h1>
      </div>
      <div className="header__badge">Live workspace</div>
    </header>
  );
};

Header.defaultProps = {
  title: 'Default Header Title',
};

export default Header;
