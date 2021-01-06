import React from "react";
import "./css/loginForm.css";
import firebase from "firebase/app";
import "firebase/auth";
import SpritjaktClient from "../services/spritjaktClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

class LoginForm extends React.Component {

    constructor() {
        super();
        this.state = { status: null, message: "" }
        this.spritjaktClient = new SpritjaktClient();
    }
    register = (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const name = event.target.name.value;
        const pass = event.target.pass.value;
        const pass2 = event.target.pass2.value;

        const notifications = {
            onAll: event.target.onAll.checked ?? false,
            onFilters: event.target.onFilters.checked ?? false,
            onFavorites: event.target.onFavorites.checked ?? false,
            byPush: event.target.byPush.checked ?? false,
            byEmail: event.target.byEmail.checked ?? false,
        }

        if (email === "") {
            this.setState({ status: false, message: "Passordet må være på minst 6 tegn" });
            return;
        }
        if (pass.length <= 5) {
            this.setState({ status: false, message: "Passordet må være på minst 6 tegn" });
            return;
        }
        if (pass !== pass2) {
            this.setState({ status: false, message: "Passordene er ikke like" });
            return;
        }

        firebase.auth().createUserWithEmailAndPassword(email, pass)
            .then(async () => {

                await this.spritjaktClient.CreateUserDoc(name, notifications);

                this.setState({ status: true, message: "Registrering vellykket" });
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
            })
            .catch((error) => {
                this.setState({ status: false, message: "Feil e-postadresse eller passord" });
            });
    }

    resetPassword = (event) => {
        event.preventDefault();

        const email = event.target[0].value;

        firebase.auth().sendPasswordResetEmail(email).then(() => {
            this.setState({ status: true, message: "Vi har send deg en link på e-post hvor du kan tilbakestille passordet ditt." });
        }).catch((error) => {
            this.setState({ status: false, message: error.message });
        });
    }

    render() {
        return (
            <div>
                <h2>{this.props.heading}</h2>
                {this.props.resetPass ?
                    <form className="loginForm" onSubmit={this.resetPassword}>
                        <label>
                            E-post
                            <br />
                            <input required placeholder="Din e-postadresse" name="email" type="email" />
                        </label>
                        <br />
                        <input disabled={this.state.status !== null} className="bigGreenBtn" type="submit" value={this.props.heading} />

                    </form>
                    :
                    <form className="loginForm" onSubmit={this.props.justLogin ? this.login : this.register}>
                        <label>
                            E-post
                    <br />
                            <input required placeholder="Din e-postadresse" name="email" type="email" />
                        </label>
                        {!this.props.justLogin &&
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
                        {!this.props.justLogin &&
                            <label>
                                Bekreft passord
                                    <br />
                                <input required name="pass2" type="password" />
                            </label>
                        }
                        {!this.props.justLogin &&
                            <div >
                                <h3>Varsler</h3>
                                    Du kan endre disse innstillingene når som helst i kontrollpanelet.
                                <div className="notificationSection">
                                    <div>
                                        <h4>Varsle meg ved...</h4>
                                        <label><input type="checkbox" onChange={this.handleNotifications} name="onAll" /> Alle prisendringer</label><br />
                                        <label><input type="checkbox" onChange={this.handleNotifications} name="onFilters" /> Prisendringer i lagrede filtre</label><br />
                                        <label><input type="checkbox" onChange={this.handleNotifications} name="onFavorites" /> Prisendringer i favoritter</label><br />
                                    </div>
                                    <div>
                                        <h4>Varsle meg på...</h4>
                                        <label><input type="checkbox" name="byPush" onChange={this.handleNotifications} /> Push-varsler (Ikke på iPhone)</label><br />
                                        <label><input type="checkbox" name="byEmail" onChange={this.handleNotifications} /> E-post</label>
                                    </div>
                                </div>
                            </div>
                        }
                        <br />
                        <input className="bigGreenBtn" type="submit" value={this.props.heading} />
                    </form>
                }
                {this.state.status != null &&
                    <div className={"statusMessage" + (this.state.status ? " success" : " error")}>
                        {!this.state.status && <FontAwesomeIcon icon={faExclamationCircle} />}
                        {this.state.message}
                    </div>
                }
            </div>
        );
    }
}

export default LoginForm;
