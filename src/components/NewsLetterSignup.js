import React from "react";
import "./css/newsLetterSignup.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import { faEnvelope, faCircleNotch, faPlusCircle, faMinusCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isMobile } from "react-device-detect";
import * as Scroll from "react-scroll";
import firebase from "firebase/app";
import "firebase/analytics";

class NewsLetterSignup extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            email: "",
            isActive: false,
            actionIsRegister: true,
            requestIsActive: false,
            resultMessage: ""
        }
    }

    EmailSubmit = async (e) => {
        e.preventDefault();

        if (this.state.requestIsActive || this.state.email === "") {
            return;
        }

        let resultMessage;
        await this.setState({ requestIsActive: true });
        if (this.state.actionIsRegister) {

            firebase.analytics().logEvent("newsletter_signon");
            await SpritjaktClient.registerEmail(this.state.email);
            resultMessage = "Supert! Nå er du påmeldt";

        } else {
            firebase.analytics().logEvent("newsletter_signoff");
            await SpritjaktClient.removeEmail(this.state.email);
            resultMessage = "Den er god, eposten din er fjernet fra listen";
        }
        await this.setState({
            requestIsActive: false,
            resultMessage: resultMessage,
            email: ""
        });
        setTimeout(() => {
            this.setState({
                resultMessage: ""
            })
        }, 5000);
    }
    toggleSection = (e) => {
        if (!this.state.isActive) {
            Scroll.animateScroll.scrollTo(0);
        }
        this.setState({ isActive: !this.state.isActive });
    }

    render() {
        return (
            <div className={"NewsLetterWrapper " + (this.state.isActive ? " active " : "")} >
                <div className={"NewsLetterSignup " + (this.state.isActive ? " active " : "") + (isMobile ? " handheld" : " desktop")}>
                    <FontAwesomeIcon icon={faEnvelope} size="2x" />
                    <p>Få varsel på epost når varer blir satt ned i pris!</p>
                    {this.state.resultMessage !== "" &&
                        <div className="resultMessage">{this.state.resultMessage}</div>
                    }
                    <form onSubmit={this.EmailSubmit}>
                        <label>
                            Meld deg på Spritjakts helt nye nyhetsbrev<br />
                            <input disabled={!this.state.isActive} value={this.state.email} onChange={e => this.setState({ email: e.target.value })} placeholder="Din epostadresse" name="email" type="email" />
                        </label>
                        <button disabled={this.state.email === ""} className="clickable submitEmail">
                            {this.state.requestIsActive ?
                                <FontAwesomeIcon icon={faCircleNotch} />
                                :
                                this.state.actionIsRegister && !this.state.requestIsActive ? "Meld meg på" : "Fjern meg"
                            }
                        </button>
                    </form>

                    <label className="unassign">
                        <input disabled={!this.state.isActive} type="checkbox" value={this.state.actionIsRegister} onChange={e => this.setState({ actionIsRegister: !this.state.actionIsRegister })} checked={!this.state.actionIsRegister} />
                        Allerede påmeldt, og vil ikke mer?
                    </label>
                    <p style={{ fontSize: "0.75rem" }}>
                        Eposten din vil bare bli brukt til å sende varlser om prisjusteringer, og vil aldri under noen omstendigheter selges eller gis videre til noen tredjepart.<br />
                        Kors på halsen, ti kniver i hjertet, mor og far i døden!
                    </p>
                </div>
                <button className="activateNL" aria-label="Åpne seksjon for nyhetsbrev" onClick={this.toggleSection} >
                    {this.state.isActive ?
                        <FontAwesomeIcon icon={faMinusCircle} size="2x" />
                        :
                        <FontAwesomeIcon icon={faPlusCircle} size="2x" />
                    }
                </button>
                <div className="overlay" onClick={this.toggleSection} ></div>
            </div >
        );
    }
}

export default NewsLetterSignup;
