import React from "react";
import "./css/notificationSettings.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import MiniProduct from "./MiniProduct";
import { faEnvelope, faCircleNotch, faPlusCircle, faMinusCircle, faEdit, faTrash, faArrowCircleRight, faTimesCircle, faArrowCircleLeft, faHamburger, faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as Scroll from "react-scroll";
import firebase from "firebase/app";
import "firebase/analytics";
import ProductPopUp from "./ProductPopUp";
import queryString, { parse } from "query-string";


class NotificationSettings extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isActive: false,
            resultMessage: "",
            user: null,
            stores: [],
            highlightedProduct: false,
        }
        this.spritjaktClient = new SpritjaktClient();
    }

    async componentDidMount() {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.settings) {
            setTimeout(() => this.toggleSection(true), 1500)
        }
        firebase.auth().onAuthStateChanged((user) => {
            this.setState({ user: user });
            if (user) {
                firebase.firestore().collection("Users").doc(user.uid)
                    .onSnapshot(async (doc) => {
                        let userData = doc.data();
                        let products = await this.spritjaktClient.FetchProductsById(userData.products);
                        let stores = await this.spritjaktClient.FetchStores();
                        stores.push({ storeName: "vinmonopolet.no", storeId: "online" });
                        this.setState({ userData: userData, productResult: products, stores: stores });
                    });
            }
        });
    }
    toggleSection = (isActive) => {
        let parsed = queryString.parse(window.location.search);
        parsed.settings = isActive;
        if (!isActive) {
            delete parsed.settings;
        }
        let query = queryString.stringify(parsed, { arrayFormat: 'comma' });
        this.setState({ isActive: isActive });
        window.history.replaceState('', '', '?' + query);
    }

    logout() {
        firebase.auth().signOut().then(function () {
        }).catch(function (error) {
            alert(error.message);
        });
    }
    renderProducts() {
        let items = [];
        for (const product of this.state.productResult) {
            items.push(<MiniProduct product={product} setGraph={this.setGraph.bind(this)} removeProduct={() => { this.spritjaktClient.RemoveProductFromUser(product.Id) }} />);
        }
        return items;
    }

    applyFilter = (filter) => {
        let urlParams = { stores: ["0"] };

        if (filter.stores.length > 0) {
            filter.stores.map(s => s = s.storeId);
            urlParams.stores = filter.stores;
        }
        urlParams.filter = filter.productTypes;

        let query = queryString.stringify(urlParams, { arrayFormat: 'comma' });
        window.history.replaceState('', '', '?' + query);
        this.props.applyUserFilter();
    }


    renderFilters() {
        let items = [];
        for (const filter of this.state.userData.filters) {

            let storeNames = [];
            filter.stores.forEach(id => {
                storeNames.push(this.state.stores.find(s => s.storeId == id).storeName);
            });

            items.push(<li className="filter">
                <div onClick={() => { this.applyFilter(filter) }} className="stores">{storeNames.length > 0 ? storeNames.join().replace(/,/g, ", ") : "Alle"}</div>
                <div onClick={() => { this.applyFilter(filter) }} className="productTypes">{filter.productTypes.length > 0 ? filter.productTypes.join().replace(/,/g, ", ") : "Alle"}</div>
                <div className="operations">
                    <button className="iconBtn dark" onClick={() => { this.spritjaktClient.removeUserFilter(filter) }} >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </li>);
        }
        return items;
    }

    nextProduct = (change) => {
        let highlightedProductIndex = this.state.productResult.indexOf(this.state.highlightedProduct);
        let newHighlightedProduct = this.state.productResult[highlightedProductIndex + change] ?? null;
        this.setGraph(null, null);
        if (newHighlightedProduct) {
            this.setGraph(newHighlightedProduct.Id);
        }
    }

    setGraph = (productId) => {
        if (productId === null || productId === this.state.highlightedProduct.Id) {
            this.setState({ highlightedProduct: false, graphIsVisible: false });
        } else {
            let product = this.state.productResult.find((p) => p.Id === productId);
            this.setState({ highlightedProduct: product, graphIsVisible: true });

            firebase.analytics().logEvent("select_item");
        }
    };

    render() {
        let { user, userData, productResult } = this.state;

        return (
            <div>
                {user && userData &&
                    <div class="profileStatusBar">
                        <div>Hei <span class="userEmail">{this.state.userData?.name}</span>!</div>
                        <button aria-label="Vis innstillinger" name="Togglesettings" onClick={() => this.toggleSection(!this.state.isActive)} className="iconBtn toggleSettings">
                            <FontAwesomeIcon size="lg" icon={faBars} />
                        </button>
                    </div>
                }
                {user && userData &&
                    <div className={"NotificationSettings " + (this.state.isActive ? " active " : "")} >
                        <div className="sectionHeader">
                            <button aria-label="Skjul innstillinger" name="Togglesettings" onClick={() => this.toggleSection(!this.state.isActive)} className="iconBtn toggleSettings">
                                <FontAwesomeIcon size="lg" icon={faTimesCircle} />
                            </button>
                            <button name="logout" onClick={this.logout} className="bigGreenBtn clickable logout">Logg ut</button>
                        </div>
                        <div className="heading">
                            <h2>Min konto</h2>
                            <p>
                                <strong>Når vil du få varsler?</strong>
                            </p>
                            <label><input type="checkbox" name="GetNotification" /> Ved alle prisendringer</label><br />
                            <label><input type="checkbox" name="GetNotification" /> Ved prisendringer i mine lagrede søk</label><br />
                            <label><input type="checkbox" name="GetNotification" /> Ved prisendringer på mine favoritter</label><br />
                            <p>
                                <strong>Hvordan vil du bli varslet?</strong>
                            </p>
                            <label><input type="checkbox" /> Push-varsler (Ikke tilgjengelig på iPhone)</label><br />
                            <label><input type="checkbox" /> Epost</label>
                        </div>
                        <br />
                        <hr />
                        {userData.filters.length > 0 ?
                            <div className="filters">
                                <div className="sectionHeader">
                                    <h3>Lagrede søk ({this.state.userData.filters.length})</h3>
                                </div>
                                <ul class="list filters">
                                    <li class="listHeaders filter">
                                        <div className="stores">Butikker</div>
                                        <div className="productTypes">Varetyper</div>
                                        <div className="operations"></div>
                                    </li>
                                    {this.renderFilters()}
                                </ul>
                            </div>
                            :
                            <div className="filters">
                                <div className="sectionHeader">
                                    <h3>Lagrede søk</h3>
                                </div>
                                <p>De lagrede søkene dine vil dukke opp her.</p>
                            </div>
                        }
                        <br />
                        <hr />
                        {productResult.length > 0 ?
                            <div className="favorites">
                                <div className="sectionHeader">
                                    <h3>Favoritter ({this.state.productResult.length})</h3>
                                </div>
                                <ul class="list miniproducts">{this.renderProducts()}</ul>
                            </div>
                            :
                            <div className="filters">
                                <div className="sectionHeader">
                                    <h3>Favoritter</h3>
                                </div>
                                <p>Her listes favorittproduktene dine opp.</p>
                            </div>
                        }
                        <ProductPopUp product={this.state.highlightedProduct} graphIsVisible={this.state.graphIsVisible} nextProduct={this.nextProduct.bind(this)} setGraph={this.setGraph.bind(this)} />
                    </div >
                }
            </div>
        );
    }
}

export default NotificationSettings;
