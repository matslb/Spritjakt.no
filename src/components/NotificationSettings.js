import React from "react";
import "./css/notificationSettings.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import MiniProduct from "./MiniProduct";
import { faEnvelope, faCircleNotch, faPlusCircle, faMinusCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isMobile } from "react-device-detect";
import * as Scroll from "react-scroll";
import firebase from "firebase/app";
import "firebase/analytics";

class NotificationSettings extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isActive: false,
            resultMessage: "",
            user: null
        }
        this.spritjaktClient = new SpritjaktClient();
    }
    async componentDidMount() {
        firebase.auth().onAuthStateChanged((user) => {
            this.setState({user: user});
            if(user){
                firebase.firestore().collection("Users").doc(user.uid)
                .onSnapshot(async (doc) => {
                    let userData = doc.data();
                    let products = await this.spritjaktClient.FetchProductsById(userData.products);
                    this.setState({userData: userData, products: products});
                });
            }
        });
      }
    toggleSection = (e) => {
        if (!this.state.isActive) {
            Scroll.animateScroll.scrollTo(0);
        }
        this.setState({ isActive: !this.state.isActive });
    }

    renderProducts(){
        let items = [];
        for (const product of this.state.products) {
            items.push(<MiniProduct product={product} /> );
        }
        return items;
    }

    render() {
        let {user, userData, products} = this.state;
        
        return (
            <div>
                {user && userData &&
                <div className={"NotificationSettings " + (this.state.isActive ? " active " : "")} >
                    <div className="heading">
                        <h3>Innstillinger</h3>
                        <p>Her kan du kontrollere når og hvor du skal få varsler</p>
                    </div>
                    
                    {products.length > 0 &&
                        <div className="favorites">
                            <h4>Favoritter</h4>
                            <ul class="list miniproducts">{this.renderProducts()}</ul>
                        </div>

                    }

                </div >
                }
            </div>
        );
    }
}

export default NotificationSettings;
