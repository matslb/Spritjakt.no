import React from "react";
import "./css/loginForm.css";
import firebase from "firebase/app";
import "firebase/auth";
import SpritjaktClient from "../services/spritjaktClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { NotificationSection, handleSubmitEvent } from "./NotificationSection";
import { formTypes } from "../utils/utils";

class LoginForm extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            formType: this.props.formType || formTypes.login,
            message: ""
        }
    }
    componentDidMount() {
        window.scroll({ top: 0, left: 0, behavior: 'smooth' })
    }
    register = (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const name = event.target.name.value;
        const pass = event.target.pass.value;
        const pass2 = event.target.pass2.value;

        if (pass.length <= 5) {
            this.setState({ status: false, message: "Passordet må være på minst 6 tegn" });
            return;
        }
        if (pass !== pass2) {
            this.setState({ status: false, message: "Passordene er ikke like" });
            return;
        }
        var notifications = handleSubmitEvent(event);
        firebase.auth().createUserWithEmailAndPassword(email, pass)
            .then(async () => {
                await SpritjaktClient.CreateUserDoc(name, notifications);
                firebase.analytics().logEvent("user_registration");
                this.setState({ status: true, message: "Registrering vellykket" });
                this.props.setFormType(null);
            })
            .catch((error) => {
                this.setState({ status: false, message: error.message });
            });
    }

    login = (event) => {
        event.preventDefault();

        const email = event.target.email.value;
        const pass = event.target.pass.value;

        firebase.auth().signInWithEmailAndPassword(email, pass)
            .then(() => {
                this.setState({ status: true, message: "Innlogging vellykket" });
                firebase.analytics().logEvent("user_login");
                this.props.setFormType(null);
            })
            .catch((error) => {
                this.setState({ status: false, message: "Feil e-postadresse eller passord" });
            });
    }

    resetPassword = (event) => {
        event.preventDefault();

        const email = event.target[0].value;

        firebase.auth().sendPasswordResetEmail(email).then(() => {
        }).catch((error) => {
        });
        firebase.analytics().logEvent("user_reset_password");
        this.setState({ status: true, message: "Vi har send deg en link på e-post hvor du kan tilbakestille passordet ditt." });
    }

    render() {
        let { formType } = this.props;
        return (
            <div>
                {formType === formTypes.resetPass ?
                    <form className="loginForm resetPass" onSubmit={this.resetPassword}>
                        <h2>{formType}</h2>
                        <label>
                            E-post
                            <br />
                            <input required placeholder="Din e-postadresse" name="email" type="email" />
                        </label>
                        <br />
                        <input disabled={this.state.status} className="bigGreenBtn" type="submit" value={formType} />

                    </form>
                    :

                    <form className="loginForm" onSubmit={formType === formTypes.login ? this.login : this.register}>
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
                {this.state.status !== undefined &&
                    <div className={"statusMessage" + (this.state.status ? " success" : " error")}>
                        {!this.state.status ? <FontAwesomeIcon icon={faExclamationCircle} />
                            :
                            <FontAwesomeIcon icon={faCheckCircle} />
                        }
                        {this.state.message}
                    </div>
                }
            </div>
        );
    }
}

export default LoginForm;
