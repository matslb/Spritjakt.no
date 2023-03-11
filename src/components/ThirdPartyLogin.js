import React, { useEffect } from "react";
import firebase from "firebase/compat/app";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import "./css/thirdPartyLogin.css";
import { getProviderAuth, getProviderImg } from "../utils/utils";

const ThirdPartyLogin = ({
    provider
}) => {

    useEffect(() => {
        logIn();
    }, []);

    const logIn = () => {
        firebase.auth().useDeviceLanguage();
        firebase.auth().signInWithRedirect(getProviderAuth(provider))
    }
    return (
        <div className="ThirdPartyLogin">
            <img src={getProviderImg(provider)} alt={provider} height="75px" width="75px" style={{ imageRendering: "-webkit-optimize-contrast" }} />
            <h3>
                Du blir videresendt til innloggingen...
                <br />
                <br />
                <div className="loader-wrapper">
                    <FontAwesomeIcon icon={faCircleNotch} size="3x" />
                </div>
            </h3>
        </div>
    );
}

export default ThirdPartyLogin;