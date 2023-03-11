import React, { useEffect, useState } from "react";
import "./css/loginForm.css";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import SpritjaktClient from "../services/spritjaktClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { NotificationSection, handleSubmitEvent } from "./NotificationSection";
import { formTypes } from "../utils/utils";

const LoginForm = ({
    formType,
    setFormType
}) => {

    const [errorMessage, setErrorMessage] = useState({ status: null, message: "" });

    useEffect(() => {
        window.scroll({ top: 0, left: 0, behavior: 'smooth' });
        setErrorMessage({ status: null, message: "" });
    }, [formType]);

    const register = (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const name = event.target.name.value;
        const pass = event.target.pass.value;
        const pass2 = event.target.pass2.value;

        if (pass.length <= 5) {
            setErrorMessage({ status: false, message: "Passordet må være på minst 6 tegn" });
            return;
        }
        if (pass !== pass2) {
            setErrorMessage({ status: false, message: "Passordene er ikke like" });
            return;
        }
        var notifications = handleSubmitEvent(event);
        firebase.auth().createUserWithEmailAndPassword(email, pass)
            .then(async () => {
                await SpritjaktClient.CreateUserDoc(name, notifications);
                firebase.analytics().logEvent("user_registration");
                setErrorMessage({ status: true, message: "Registrering vellykket" });
                setFormType(null);
            })
            .catch((error) => {
                setErrorMessage({ status: false, message: error.message });
            });
    }

    const login = (event) => {
        event.preventDefault();

        const email = event.target.email.value;
        const pass = event.target.pass.value;

        firebase.auth().signInWithEmailAndPassword(email, pass)
            .then(() => {
                setErrorMessage({ status: true, message: "Innlogging vellykket" });
                firebase.analytics().logEvent("user_login");
                setFormType(null);
            })
            .catch((error) => {
                setErrorMessage({ status: false, message: "Feil e-postadresse eller passord" });
            });
    }

    const resetPassword = (event) => {
        event.preventDefault();

        const email = event.target[0].value;

        firebase.auth().sendPasswordResetEmail(email).then(() => {
        }).catch((error) => {
        });
        firebase.analytics().logEvent("user_reset_password");
        setErrorMessage({ status: true, message: "Vi har send deg en link på e-post hvor du kan tilbakestille passordet ditt." });
    }

    return (
        <div>
            {formType === formTypes.resetPass ?
                <form className="loginForm resetPass" onSubmit={resetPassword}>
                    <h2>{formType}</h2>
                    <label>
                        E-post
                        <br />
                        <input required placeholder="Din e-postadresse" name="email" type="email" />
                    </label>
                    <br />
                    <input disabled={errorMessage.status} className="bigGreenBtn" type="submit" value={formType} />

                </form>
                :

                <form className="loginForm" onSubmit={formType === formTypes.login ? login : register}>
                    <h2>{formType}</h2>
                    <label>
                        E-post
                        <br />
                        <input required placeholder="Din e-postadresse" name="email" type="email" />
                    </label>
                    {formType === formTypes.register &&
                        <label>
                            Navn
                            <br />
                            <input required placeholder="Navnet ditt" name="name" type="text" />
                        </label>
                    }
                    <label>
                        Passord
                        <br />
                        <input required name="pass" type="password" />
                    </label>
                    {formType === formTypes.register &&
                        <label>
                            Bekreft passord
                            <br />
                            <input required name="pass2" type="password" />
                        </label>
                    }
                    {formType === formTypes.register &&
                        <NotificationSection />
                    }
                    <br />
                    <input className="bigGreenBtn clickable" type="submit" value={formType} />
                </form>
            }
            {errorMessage.status !== null &&
                <div className={"statusMessage" + (errorMessage.status ? " success" : " error")}>
                    {!errorMessage.status ? <FontAwesomeIcon icon={faExclamationCircle} />
                        :
                        <FontAwesomeIcon icon={faCheckCircle} />
                    }
                    {errorMessage.message}
                </div>
            }
        </div>
    );
}

export default LoginForm;
