import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { ThemeProvider } from "@emotion/react";

const Homepage = () => {
  const MainContentRef = useRef(null);
  const LoginPageRef = useRef(null);
  const [content, setContent] = useState(null);

  // Parsing and setting initial state based on query parameters
  useEffect(() => {
    const parsed = queryString.parse(window.location.search);

    if (parsed?.source) {
      firebase.analytics().logEvent(`${parsed.source}_referral`);
      delete parsed.source;
      window.history.replaceState("", "", `?${queryString.stringify(parsed)}`);
    }
    if (parsed.content) {
      firebase.analytics().logEvent(`${parsed.content}_content`);
      setContent(parsed.content);
    }

    const handlePopState = (e) => onBackPress(e);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Handle back navigation events
  const onBackPress = useCallback(() => {
    const query = queryString.parse(window.location.search, {
      arrayFormat: "comma",
    });
    MainContentRef.current?.highlightProduct(query.product || null);
  }, []);

  // Toggle the login section view
  const toggleLoginSection = useCallback(() => {
    LoginPageRef.current?.setFormType(formTypes.register);
  }, []);

  // Apply user filter in MainContent component
  const applyUserFilter = useCallback(() => {
    MainContentRef.current?.applyUserFilter();
  }, []);

  // Update the content state and URL query parameters
  const handleChangeType = useCallback((newContent) => {
    const parsed = queryString.parse(window.location.search);
    if (newContent) {
      parsed.content = newContent;
    } else {
      delete parsed.content;
    }
    window.history.replaceState("", "", `?${queryString.stringify(parsed)}`);
    setContent(newContent);

    if (newContent !== "hall-of-fame") {
      MainContentRef.current?.fetchInitialData();
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <div className="homepage">
        <nav className="navigation">
          <ul className="nav-list">
            <li className="nav-element">
              <button
                className={`clickable ${
                  !content || content === "lowered" ? "active" : ""
                }`}
                onClick={() => handleChangeType(null)}
              >
                <FontAwesomeIcon icon={faWineBottle} size="lg" />
                Alle varer
              </button>
            </li>
            <li className="nav-element">
              <button
                className={`clickable ${
                  content === "hall-of-fame" ? "active" : ""
                }`}
                onClick={() => handleChangeType("hall-of-fame")}
              >
                <FontAwesomeIcon icon={faFire} size="lg" />
                Hall of fame
              </button>
            </li>
            <li className="nav-element">
              <a className="clickable" href="https://butikk.spritjakt.no">
                <FontAwesomeIcon icon={faStore} size="lg" />
                Spritjaktbutikken
              </a>
            </li>
          </ul>
        </nav>
        <LoginPage ref={LoginPageRef} />
        {/*<BarcodeScanner />*/}

        {content === "hall-of-fame" ? (
          <HallOfFame />
        ) : (
          <MainContent
            toggleLoginSection={toggleLoginSection}
            ref={MainContentRef}
          />
        )}
        <AccountSettings applyUserFilter={applyUserFilter} />
        <SupportWrapper />
      </div>
    </ThemeProvider>
  );
};

export default Homepage;
