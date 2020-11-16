import { faMinusCircle, faPlusCircle, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import LoginForm from "./LoginForm";
import "./css/loginPage.css";
import firebase from "firebase/app";

class LoginPage extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            user: null,
            justLogin: null,
            resetPass: false,
            isActive: false
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
    }
    toggleSection = (e) => {
        this.setState({ isActive: !this.state.isActive });
    }

    render() {
        return (
            <div className={"loginPage " + (this.state.justLogin !== null && !this.state.user ? " active " : "")} >
                { !this.state.user &&
                    <div onClick={() => { this.setState({ justLogin: true }) }} class="profileStatusBar">
                        <FontAwesomeIcon size="lg" icon={faUser} />
                        <a>Logg inn</a>
                    </div>
                }
                {this.state.justLogin != null &&
                    <div>
                        {this.state.user == null &&
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
                                    <p>Har du allerede en bruker?<br /><a onClick={() => this.setState({ justLogin: true })}>Logg inn</a></p>
                                    :
                                    <div>
                                        {!this.state.resetPass ?
                                            <p>Mistet passordet? <a onClick={() => this.setState({ resetPass: true })}>Sett nytt passord</a></p>
                                            :
                                            <p><a onClick={() => this.setState({ resetPass: false })}>Tilbake til innlogging</a></p>
                                        }
                                        <br />
                                        <p>Har du ikke bruker?<br /><a onClick={() => this.setState({ justLogin: false })}> Registrer deg</a></p>
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
