import React from "react";
import "./css/notification.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

export default class Notification extends React.Component {
    constructor() {
        super();
        this.state = {
        };
    }
    setNotification = (event, message, theme) => {
        let target = event ? event.currentTarget.getBoundingClientRect() : {
            top: window.innerHeight / 4 * 3,
            left: 0,
            width: window.innerWidth
        };
        let state = this.state;
        let key = Date.now();
        state[key] = {
            showMessage: true,
            target: {
                top: target.top + window.scrollY,
                left: target.left,
                width: target.width
            },
            message: message,
            theme: theme
        };
        this.setState(state);
        setTimeout(() => {
            state = this.state;
            state[key].showMessage = false;
            this.setState(state)

        }, 1000);
        setTimeout(() => {
            state = this.state;
            delete state[key];
            this.setState(state)
        }, 2000);
    }
    render() {
        if (!this.state) {
            return null;
        }

        return (
            <div>
                {
                    Object.keys(this.state).map((key) => {
                        let noti = this.state[key];
                        let y = noti.target.top - 54;
                        let x = noti.target.left + ((noti.target.width) / 2) - (noti.message.length * 3.2);
                        return (
                            <div key={key} style={{ top: y, left: x }} className={"notification " + noti.theme + " " + noti.showMessage}>
                                {noti.theme === "success" ?
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                    :
                                    <FontAwesomeIcon icon={faTimesCircle} />
                                }
                                {noti.message}
                            </div>
                        );
                    })
                }
            </div>

        );
    }
}
