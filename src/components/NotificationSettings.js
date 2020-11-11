import React from "react";
import "./css/notificationSettings.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import MiniProduct from "./MiniProduct";
import { faEnvelope, faCircleNotch, faPlusCircle, faMinusCircle, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
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
            user: null,
            stores: null
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
                    let stores = await this.spritjaktClient.FetchStores();
                    this.setState({userData: userData, products: products, stores: stores});
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
    renderFilters(){
        let items = [];
        for (const filter of this.state.userData.filters) {

            let storeNames = [];
            filter.stores.forEach(id =>{
                storeNames.push(this.state.stores.find(s => s.storeId == id).storeName);
            });

            items.push(<li className="filter">
                <div className="stores">{storeNames.join()}</div>
                <div className="productTypes">{filter.productTypes.join()}</div>
                <div className="operations">
                    <FontAwesomeIcon icon={faTrash} onClick={() => {this.spritjaktClient.removeUserFilter(filter)}} />
                </div>
            </li> );
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
                    
                    {userData.filters.length > 0 &&
                        <div className="filters">
                            <h4>Lagrede søk</h4>
                            <ul class="list filters">{this.renderFilters()}</ul>
                        </div>
                    }
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
