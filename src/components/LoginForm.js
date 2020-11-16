import React from "react";
import "./css/loginForm.css";
import firebase from "firebase";
import SpritjaktClient from "../datahandlers/spritjaktClient";

class LoginForm extends React.Component {

    constructor() {
        super();
        this.state = { status: null, message: "" }
        this.spritjaktClient = new SpritjaktClient();
    }
    register = (event) => {
        event.preventDefault();
        const email = event.target[0].value;
        const name = event.target[1].value;
        const pass = event.target[2].value;
        const pass2 = event.target[3].value;

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

                await this.spritjaktClient.CreateUserDoc(name);

                this.setState({ status: true, message: "Registrering vellykket" });
            })
            .catch((error) => {
                this.setState({ status: false, message: error.message });
            });
    }

    login = (event) => {
        event.preventDefault();

        const email = event.target[0].value;
        const pass = event.target[1].value;

        firebase.auth().signInWithEmailAndPassword(email, pass)
            .then(() => {
                this.setState({ status: true, message: "Innlogging vellykket" });
            })
            .catch((error) => {
                this.setState({ status: false, message: "Feil epostadresse eller passord" });
            });
    }

    resetPassword = (event) => {
        event.preventDefault();

        const email = event.target[0].value;

        firebase.auth().sendPasswordResetEmail(email).then(() => {
            this.setState({ status: true, message: "Vi har send deg en link på epost hvor du kan tilbakestille passordet ditt." });
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
                            Epost
                  <br />
                            <input required placeholder="Din epostadresse" name="email" type="email" />
                        </label>
                        <br />
                        <input disabled={this.state.status !== null} className="bigGreenBtn" type="submit" value={this.props.heading} />

                    </form>
                    :
                    <form className="loginForm" onSubmit={this.props.justLogin ? this.login : this.register}>
                        <label>
                            Epost
                    <br />
                            <input required placeholder="Din epostadresse" name="email" type="email" />
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
                        <br /><input required name="pass2" type="password" />
                            </label>
                        }
                        <br />
                        <input className="bigGreenBtn" type="submit" value={this.props.heading} />
                    </form>
                }
                {this.state.status != null &&
                    <div className={"statusMessage" + this.state.status ? " success" : " error"}>
                        {this.state.message}
                    </div>
                }
            </div>
        );
    }
}

export default LoginForm;
