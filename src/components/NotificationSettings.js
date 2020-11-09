import React from "react";
import "./css/notificationSettings.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import { faEnvelope, faCircleNotch, faPlusCircle, faMinusCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isMobile } from "react-device-detect";
import * as Scroll from "react-scroll";
import firebase from "firebase/app";
import "firebase/analytics";
import LoginPage from "./LoginPage";

class NotificationSettings extends React.Component {
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
                <div className={"NotificationSettings " + (this.state.isActive ? " active " : "") + (isMobile ? " handheld" : " desktop")}>
                    <FontAwesomeIcon icon={faEnvelope} size="2x" />
                    <p>Varselinstillinger</p>
                    {this.state.resultMessage !== "" &&
                        <div className="resultMessage">{this.state.resultMessage}</div>
                    }
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

export default NotificationSettings;
