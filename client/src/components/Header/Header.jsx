import React from "react";
import './header.scss'; 


const Header = ({ title }) => {
  return (
    <header className="header">
      <h1>{title}</h1>
    </header>
  );
};

Header.defaultProps = {
  title: 'Default Header Title',
};

export default Header;
