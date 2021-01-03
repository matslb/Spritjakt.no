import { faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import LoginForm from "./LoginForm";
import "./css/loginPage.css";
import firebase from "firebase/app";
import queryString from "query-string";

class LoginPage extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            user: null,
            justLogin: null,
            resetPass: false,
        }
    }

    componentDidMount() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.setState({ user: user });
            } else {
                this.setState({ user: null });
            }
        });
        let parsed = queryString.parse(window.location.search);
        if (parsed?.login) {
            this.toggleLoginSection();
        }
    }
    toggleLoginSection = (e) => {
        this.setState({ justLogin: true });
    }

    render() {
        return (
            <div className={"loginPage " + (this.state.justLogin !== null && !this.state.user ? " active " : "")} >
                { !this.state.user &&
                    <div onClick={() => { this.setState({ justLogin: true }) }} className="profileStatusBar">
                        <FontAwesomeIcon size="lg" icon={faUser} />
                        <button className="link">Logg inn</button>
                    </div>
                }
                {this.state.justLogin != null &&
                    <div>
                        {this.state.user === null &&
                            <div className="loginSection">
                                {(!this.state.justLogin) &&
                                    <LoginForm justLogin={this.state.justLogin} heading="Registrer deg" />
                                }
                                {(this.state.justLogin) &&
                                    <div>
                                        {!this.state.resetPass ?
                                            <LoginForm justLogin={this.state.justLogin} heading="Logg inn" />
                                            :
                                            <LoginForm justLogin={this.state.justLogin} resetPass={this.state.resetPass} heading="Tilbakestill Passord" />
                                        }

                                    </div>
                                }
                                {!this.state.justLogin ?
                                    <p>Har du allerede en bruker?<br /><button className="link" onClick={() => this.setState({ justLogin: true })}>Logg inn</button></p>
                                    :
                                    <div>
                                        {!this.state.resetPass ?
                                            <div>
                                                <p>
                                                    <strong>Var du allerede påmeldt det forrige nyhetsbrevet?</strong><br />Få tilsendt link på e-post for å sette passord på kontoen din<br /> og få tilgang til personlige varsler, endring av varslingsinnstillingene, eller for å slette kontoen din.
                                                <br /><br /><button className="bigGoldBtn" onClick={() => this.setState({ resetPass: true })}>Sett passord</button>
                                                </p>
                                                <br />
                                                <p className="lostPass" >Mistet passordet?<br /><button className="link" onClick={() => this.setState({ resetPass: true })}>Sett nytt passord</button></p>
                                            </div>
                                            :
                                            <div><button className="link" onClick={() => this.setState({ resetPass: false })}>Tilbake til innlogging</button></div>
                                        }
                                        <br />
                                        <div className="register" >Har du ikke bruker?<br /><button className="link" onClick={() => this.setState({ justLogin: false })}>Registrer deg</button></div>
                                        <br />
                                    </div>
                                }
                            </div>
                        }
                    </div>
                }
                <div className="overlay" onClick={() => this.setState({ justLogin: null })}></div>
            </div>
        );
    }
}

export default LoginPage;
