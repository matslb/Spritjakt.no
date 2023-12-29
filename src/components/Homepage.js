import React from "react";
import MainContent from "./MainContent";
import queryString from "query-string";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";
import AccountSettings from "./AccountSettings";
import LoginPage from "./LoginPage";
import SupportWrapper from "./SupportWrapper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFire,
  faStore,
  faWineBottle,
} from "@fortawesome/free-solid-svg-icons";
import HallOfFame from "./HallOfFame";
import { formTypes, theme } from "../utils/utils";
import BarcodeScanner from "./BarcodeScanner";
import { ThemeProvider } from "@emotion/react";

class Homepage extends React.Component {
  constructor(props) {
    super(props);
    this.MainContent = React.createRef();
    this.LoginPage = React.createRef();
    this.Notification = React.createRef();
    this.state = {};
  }

  componentDidMount() {
    let parsed = queryString.parse(window.location.search);
    if (parsed?.source) {
      firebase.analytics().logEvent(parsed.source + "_referral");
      delete parsed.source;
      window.history.replaceState("", "", "?" + queryString.stringify(parsed));
    }
    if (parsed.content) {
      firebase.analytics().logEvent(parsed.content + "_content");
      this.setState({ content: parsed.content });
    }

    window.onpopstate = (e) => this.onbackPress(e);
  }

  onbackPress = (e) => {
    let query = queryString.parse(window.location.search, {
      arrayFormat: "comma",
    });
    this.MainContent.current.highlightProduct(query.product || null);
  };

  toggleLoginSection = () => {
    this.LoginPage.current.setFormType(formTypes.register);
  };
  applyUserFilter = () => {
    this.MainContent.current.applyUserFilter();
  };

  setChangeType = (content) => {
    let parsed = queryString.parse(window.location.search);
    delete parsed.content;
    if (content) {
      parsed.content = content;
    }
    window.history.replaceState("", "", "?" + queryString.stringify(parsed));
    this.setState({ content: content }, () => {
      if (content !== "hall-of-fame")
        this.MainContent.current.fetchInitialData();
    });
  };
  render() {
    let content = this.state.content;
    return (
      <ThemeProvider theme={theme}>
        <div className="homepage">
          <nav className="navigation">
            <ul className="nav-list">
              <li className="nav-element">
                <button
                  className={
                    "clickable " +
                    (content == undefined || content === "lowered"
                      ? "active"
                      : "")
                  }
                  onClick={() => this.setChangeType(null)}
                >
                  <FontAwesomeIcon icon={faWineBottle} size="lg" />
                  Alle varer
                </button>
              </li>
              <li className="nav-element">
                <button
                  className={
                    "clickable " + (content === "hall-of-fame" ? "active" : "")
                  }
                  onClick={() => this.setChangeType("hall-of-fame")}
                >
                  <FontAwesomeIcon icon={faFire} size="lg" />
                  Hall of fame
                </button>
              </li>
              <li className="nav-element">
                <a className={"clickable"} href="https://butikk.spritjakt.no">
                  <FontAwesomeIcon icon={faStore} size="lg" />
                  Spritjaktbutikken
                </a>
              </li>
            </ul>
          </nav>
          <LoginPage ref={this.LoginPage} />
          <BarcodeScanner />
          {this.state.content === "hall-of-fame" ? (
            <HallOfFame />
          ) : (
            <MainContent
              toggleLoginSection={this.toggleLoginSection.bind(this)}
              ref={this.MainContent}
            />
          )}
          <AccountSettings applyUserFilter={this.applyUserFilter.bind(this)} />
          <SupportWrapper />
        </div>
      </ThemeProvider>
    );
  }
}

export default Homepage;
