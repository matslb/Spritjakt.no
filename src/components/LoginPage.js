import { faSignInAlt, faUserAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
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
        <div className={"loginProvider " + provider} onClick={() => setFormType(formTypes.login, provider)} >
            <img src={providerImg} alt={provider} height="75px" width="75px" style={{ imageRendering: "-webkit-optimize-contrast" }} />
            <p>Logg inn med <span style={{ textTransform: "capitalize" }}>{provider}</span>-kontoen din</p>
            <button className="clickable iconBtn dark" aria-label={"Logg inn med " + provider + "-kontoen din"} onClick={() => setFormType(formTypes.login, provider)}>
                <FontAwesomeIcon icon={faSignInAlt} size="2x" />
            </button>
        </div>
    )
};

class LoginPage extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            user: null,
            provider: null,
            formType: null,
            userData: UserCacher.get()
        }
    }

    componentDidMount() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.setState({ user: user });
                this.setFormType(null);
            } else {
                this.setState({ user: null, userData: null });
            }
        });

        let parsed = queryString.parse(window.location.search);
        if (parsed?.login && this.state.userData == false) {
            this.setFormType(formTypes.login);
        }
    }

    setFormType = (formType, provider = null) => {
        this.setState({ formType: formType, provider: provider });
    }

    render() {
        let { formType, provider, user, userData } = this.state;

        return (
            <div className={"loginPage " + (formType !== null ? " active " : "")} >
                {!user && !userData &&
                    <div onClick={() => this.setFormType(formTypes.login)} className="profileStatusBar">
                        <FontAwesomeIcon icon={faUserAlt} />
                        <button style={{ color: "white" }} className="link">Logg inn</button>
                    </div>
                }
                {formType !== null &&
                    <div className={"loginSection " + (provider !== null ? " active " : "")} >
                        {provider === null &&
                            <div className={"selectLoginProvider"}>
                                {providerOption(providers.google, googleImg, this.setFormType)}
                                {providerOption(providers.facebook, facebookImg, this.setFormType)}
                                {providerOption(providers.email, emailImg, this.setFormType)}
                            </div>
                        }
                        {provider === providers.email &&
                            <div>
                                <LoginForm formType={formType} setFormType={this.setFormType} />
                                {
                                    formType !== formTypes.login ?
                                        <div className="switchLoginNotice" >Har du allerede en bruker?<br /><button className="link" onClick={() => this.setFormType(formTypes.login, providers.email)}>Logg inn</button></div>
                                        :
                                        <div style={{ textAlign: "center" }} >
                                            {formType !== formTypes.resetPass ?
                                                <div>
                                                    <p className="lostPass" >Mistet passordet?<br /><button className="link" onClick={() => this.setFormType(formTypes.resetPass, providers.email)}>Sett nytt passord</button></p>

                                                </div>
                                                :
                                                <div><button className="link" onClick={() => this.setFormType(formTypes.login, providers.email)} >Tilbake til innlogging</button></div>
                                            }
                                            <div className="switchLoginNotice" >Har du ikke bruker?<br /><button className="link" onClick={() => this.setFormType(formTypes.register, providers.email)}>Registrer deg</button></div>
                                        </div>
                                }
                            </div>
                        }
                        {provider && provider !== providers.email &&
                            <ThirdPartyLogin provider={provider} setFormType={this.setFormType} />
                        }

                    </div >
                }
                <div className="overlay" onClick={() => this.setFormType(null)}></div>
            </div >
        );
    }
}

export default LoginPage;
