import React from "react";
import "./App.css";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";
import "firebase/compat/messaging";
import Homepage from "./components/Homepage";
import Header from "./components/Header";
import "@pwabuilder/pwaupdate";

const firebaseConfig = require("./config.json");
let date = new Date();

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();

class App extends React.Component {
  render() {
    return (
      <div className="App" name="appRoot">
        <Header />
        <div className="Body">
          <Homepage />
        </div>
        <footer>
          <p>
            Spritjakt.no bruker informasjonskapsler for å håndtere
            brukerinnlogging og for innsamling av anonymisert bruksstatistikk
            gjennom Google Analytics.
            <br />
            Når du oppretter en bruker på spritjakt.no vil navn og e-post lagres
            og brukes til å sende personaliserte e-postvarsler. <br />
            Ved innlogging gjennom Google får Spritjakt.no tilgang til navnet
            ditt og e-posten din. <br />
            Når du sletter brukeren din vil dataene også slettes for godt.
          </p>
          <p>
            Spritjakt.no er ikke tilknyttet Vinmonopolet på noen måte, og feil
            kan forekomme.
          </p>
          <p>
            Har du tilbakemeldinger eller funnet noe feil? Kontakt meg på{" "}
            <a href="mailto:mats@spritjakt.no">mats@spritjakt.no</a> eller
            opprett et issue på{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/matslb/Spritjakt.no"
            >
              Github
            </a>
          </p>
          <p data-nosnippet="true">
            © 2020 - {date.getFullYear()}{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://no.linkedin.com/in/mats-l%C3%B8vstrand-berntsen-4682b2142"
            >
              Mats Løvstrand Berntsen
            </a>
          </p>
        </footer>
        <pwa-update></pwa-update>
      </div>
    );
  }
}

export default App;
