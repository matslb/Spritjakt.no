import React from "react";
import "./css/notification.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

export default class Notification extends React.Component {
    constructor() {
        super();
        this.state = {
            showMessage: false
        };
    }
    setNotification = (event, message, theme) => {
        let target = event.currentTarget.getBoundingClientRect();
        this.setState({
            showMessage: true,
            notificationProps: {
                target: {
                    top: target.top + window.pageYOffset,
                    left: target.left,
                    width: target.width
                },
                message: message,
                theme: theme
            }
        });
        setTimeout(() => { this.setState({ showMessage: false }) }, 1000);
    }
    render() {
        if (!this.state.notificationProps) {
            return null;
        }
        const { target, message, theme } = this.state.notificationProps;

        let y = target.top - 54;
        let x = target.left + ((target.width) / 2) - 26;
        return (
            <div style={{ top: y, left: x }} className={"notification " + theme + " " + this.state.showMessage}>
                {theme == "success" ?
                    <FontAwesomeIcon icon={faCheckCircle} />
                    :
                    <FontAwesomeIcon icon={faTimesCircle} />
                }
                {message}
            </div>
        );
    }
}
