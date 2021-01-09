import { faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import LoginForm from "./LoginForm";
import "./css/loginPage.css";
import firebase from "firebase/app";
import queryString from "query-string";

const formTypes = LoginForm.formTypes;

class LoginPage extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            user: null,
            formType: null
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
            this.setFormType(formTypes.login);
        }
    }

    setFormType(formType) {
        this.setState({ formType: formType });
    }

    render() {
        let { formType, user } = this.state;

        return (
            <div className={"loginPage " + (formType !== null && !user ? " active " : "")} >
                { !user &&
                    <div onClick={() => this.setFormType(formTypes.login)} className="profileStatusBar">
                        <FontAwesomeIcon size="lg" icon={faUser} />
                        <button className="link">Logg inn</button>
                    </div>
                }
                {formType != null &&
                    <div>
                        {user === null &&
                            <div className="loginSection">
                                {formType === formTypes.login &&
                                    <LoginForm formType={formType} />
                                }
                                {formType === formTypes.register &&
                                    <LoginForm formType={formType} />
                                }
                                {formType === formTypes.resetPass &&
                                    <LoginForm formType={formType} />
                                }
                                {formType !== formTypes.login ?
                                    <div className="switchLoginNotice" >Har du allerede en bruker?<br /><button className="link" onClick={() => this.setFormType(formTypes.login)}>Logg inn</button></div>
                                    :
                                    <div>
                                        {formType !== formTypes.resetPass ?
                                            <div>
                                                <p className="lostPass" >Mistet passordet?<br /><button className="link" onClick={() => this.setFormType(formTypes.resetPass)}>Sett nytt passord</button></p>
                                                <p>
                                                    <strong>Var du allerede påmeldt det forrige nyhetsbrevet?</strong><br />Få tilsendt link på e-post for å sette passord på kontoen din<br /> og få tilgang til personlige varsler,<br /> endring av varslingsinnstillingene, eller for å slette kontoen din.
                                                <br /><br /><button className="bigGoldBtn" onClick={() => this.setFormType(formTypes.resetPass)}>Sett passord</button>
                                                </p>
                                                <br />
                                            </div>
                                            :
                                            <div><button className="link" onClick={() => this.setFormType(formTypes.login)} >Tilbake til innlogging</button></div>
                                        }
                                        <div className="switchLoginNotice" >Har du ikke bruker?<br /><button className="link" onClick={() => this.setFormType(formTypes.register)}>Registrer deg</button></div>
                                    </div>
                                }
                            </div>
                        }
                    </div>
                }
                <div className="overlay" onClick={() => this.setFormType(null)}></div>
            </div>
        );
    }
}

export default LoginPage;
