import React from "react";
import "./App.css";
import { ReactComponent as ReactLogo } from "./assets/logo.svg";
import firebase from "firebase/app";
import "firebase/analytics";
import Homepage from "./components/Homepage";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
const firebaseConfig = require("./config.json");

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();
class App extends React.Component {
  render() {
    return (
      <Router className="App">
        <header className="App-header">
          <a href="">
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
          <p>
            Prishistorikk for Vinmonopolets varesortiment
          </p>
        </header>
        <div className="Body">
          <Switch>
            <Route exact path="/" component={Homepage}>
            </Route>
          </Switch>
        </div>
        <footer>
          <span>
            Har du tilbakemeldinger eller funnet noe feil? Opprett gjerne et
            issue på <a target="_blank" rel="noopener noreferrer" href="https://github.com/matslb/Spritjakt.no">Github</a>
          </span>
          <span data-nosnippet="true">© 2020 <a target="_blank" rel="noopener noreferrer" href="https://no.linkedin.com/in/mats-l%C3%B8vstrand-berntsen-4682b2142">Mats Løvstrand Berntsen</a>
          </span>
        </footer>
      </Router>
    );
  }
}

export default App;
