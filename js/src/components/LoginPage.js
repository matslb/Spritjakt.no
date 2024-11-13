import React, { useEffect, useState, useCallback } from "react";
import { faSignInAlt, faUserAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import LoginForm from "./LoginForm";
import "./css/loginPage.css";
import firebase from "firebase/compat/app";
import queryString from "query-string";
import ThirdPartyLogin from "./ThirdPartyLogin";
import { formTypes, providers } from "../utils/utils";
import googleImg from "../assets/google.png";
import facebookImg from "../assets/facebook.png";
import emailImg from "../assets/email.svg";
import UserCacher from "../services/userCache";

function providerOption(provider, providerImg, setFormType) {
  return (
    <div
      className={`loginProvider ${provider}`}
      onClick={() => setFormType(formTypes.login, provider)}
    >
      <img
        src={providerImg}
        alt={provider}
        height="75px"
        width="75px"
        style={{ imageRendering: "-webkit-optimize-contrast" }}
      />
      <p>
        Logg inn med{" "}
        <span style={{ textTransform: "capitalize" }}>{provider}</span>-kontoen
        din
      </p>
      <button
        className="clickable iconBtn dark"
        aria-label={`Logg inn med ${provider}-kontoen din`}
        onClick={() => setFormType(formTypes.login, provider)}
      >
        <FontAwesomeIcon icon={faSignInAlt} size="2x" />
      </button>
    </div>
  );
}

const LoginPage = () => {
  const [user, setUser] = useState(null);
  const [provider, setProvider] = useState(null);
  const [formType, setFormTypeState] = useState(null);
  const [userData, setUserData] = useState(UserCacher.get());

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        setFormTypeState(null);
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    const parsed = queryString.parse(window.location.search);
    if (parsed?.login && !userData) {
      setFormTypeState(formTypes.login);
    }

    return () => unsubscribe();
  }, [userData]);

  const setFormType = useCallback((formType, provider = null) => {
    setFormTypeState(formType);
    setProvider(provider);
  }, []);

  return (
    <div className={`loginPage ${formType !== null ? "active" : ""}`}>
      {!user && !userData && (
        <div
          onClick={() => setFormType(formTypes.login)}
          className="profileStatusBar"
        >
          <FontAwesomeIcon icon={faUserAlt} />
          <button style={{ color: "white" }} className="link">
            Logg inn
          </button>
        </div>
      )}
      {formType !== null && (
        <div className={`loginSection ${provider !== null ? "active" : ""}`}>
          {provider === null && (
            <div className="selectLoginProvider">
              {providerOption(providers.google, googleImg, setFormType)}
              {providerOption(providers.facebook, facebookImg, setFormType)}
              {providerOption(providers.email, emailImg, setFormType)}
            </div>
          )}
          {provider === providers.email && (
            <div>
              <LoginForm formType={formType} setFormType={setFormType} />
              {formType !== formTypes.login ? (
                <div className="switchLoginNotice">
                  Har du allerede en bruker?
                  <br />
                  <button
                    className="link"
                    onClick={() =>
                      setFormType(formTypes.login, providers.email)
                    }
                  >
                    Logg inn
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  {formType !== formTypes.resetPass ? (
                    <div>
                      <p className="lostPass">
                        Mistet passordet?
                        <br />
                        <button
                          className="link"
                          onClick={() =>
                            setFormType(formTypes.resetPass, providers.email)
                          }
                        >
                          Sett nytt passord
                        </button>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        className="link"
                        onClick={() =>
                          setFormType(formTypes.login, providers.email)
                        }
                      >
                        Tilbake til innlogging
                      </button>
                    </div>
                  )}
                  <div className="switchLoginNotice">
                    Har du ikke bruker?
                    <br />
                    <button
                      className="link"
                      onClick={() =>
                        setFormType(formTypes.register, providers.email)
                      }
                    >
                      Registrer deg
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {provider && provider !== providers.email && (
            <ThirdPartyLogin provider={provider} setFormType={setFormType} />
          )}
        </div>
      )}
      <div className="overlay" onClick={() => setFormType(null)}></div>
    </div>
  );
};

export default LoginPage;
