import React from "react";
import logo from "../assets/logo.svg";
import "./css/header.css";
const Header = () => {
  return (
    <header className="App-header">
      <div className="sitename">
        <a href="/">
          <h1>
            <img alt="Spritjakt" src={logo} />
            <span
              style={{
                width: 0,
                overflow: "hidden",
              }}
            >
              Spritjakt
            </span>
          </h1>
        </a>
        <h2>
          Følg prisene på øl, vin og brennevin og se når Vinmonopolet setter ned
          prisene.
        </h2>
      </div>
    </header>
  );
};

export default Header;
