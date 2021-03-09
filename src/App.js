import React from "react";
import "./App.css";
import { ReactComponent as ReactLogo } from "./assets/logo.svg";
import firebase from "firebase/app";
import "firebase/analytics";
import "firebase/messaging";
import Homepage from "./components/Homepage";

const firebaseConfig = require("./config.json");
let date = new Date();

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <a href="/">
            <h1>
              <ReactLogo />
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
          <h2 style={{ fontSize: "1.1rem", fontWeight: 400 }}>
            Se når Vinmonopolet har tilbud!
          </h2>
        </header>
        <div className="Body">
          <Homepage />
        </div>
        <footer>
          <span>
            Har du tilbakemeldinger eller funnet noe feil? Opprett gjerne et
            issue på <a target="_blank" rel="noopener noreferrer" href="https://github.com/matslb/Spritjakt.no">Github</a>
          </span>
          <span data-nosnippet="true">© {date.getFullYear()} <a target="_blank" rel="noopener noreferrer" href="https://no.linkedin.com/in/mats-l%C3%B8vstrand-berntsen-4682b2142">Mats Løvstrand Berntsen</a>
          </span>
          <p>Spritjakt.no er ikke tilknyttet Vinmonopolet på noen måte.</p>
        </footer>

      </div>
    );
  }
}

export default App;
