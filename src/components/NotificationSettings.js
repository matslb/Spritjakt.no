import React from "react";
import "./css/notificationSettings.css";
import SpritjaktClient from "../services/spritjaktClient";
import MiniProduct from "./MiniProduct";
import { faTrash, faTimesCircle, faBars, faFilter, faPen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import firebase from "firebase/app";
import "firebase/analytics";
import ProductPopUp from "./ProductPopUp";
import queryString from "query-string";
import NotificationService from "../services/notificationService";

const startState = {
    isActive: false,
    resultMessage: "",
    user: null,
    stores: [],
    userData: false,
    highlightedProduct: false,
    deleteProcessStarted: false,
    notifications: {
        onAll: false,
        onFilters: false,
        onFavorites: false,
        byPush: false,
        byEmail: false,
    }
};

class NotificationSettings extends React.Component {
    constructor(props) {
        super(props);
        this.state = startState;
        this.spritjaktClient = new SpritjaktClient();
        this.notificationService = new NotificationService();
    }

    async componentDidMount() {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.settings) {
            setTimeout(() => this.toggleSection(true), 1500)
        }
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                firebase.firestore().collection("Users").doc(user.uid)
                    .onSnapshot(async (doc) => {
                        let userData = doc.data();
                        if (userData) {
                            let products = [];
                            if (userData.products) {
                                products = await this.spritjaktClient.FetchProductsById(userData.products);
                            }
                            let stores = await this.spritjaktClient.FetchStores();
                            stores.push({ storeName: "vinmonopolet.no", storeId: "online" });
                            this.setState({ user: user, userData: userData, notifications: userData.notifications, productResult: products, stores: stores });

                            if (userData.notifications.byPush) {
                                this.notificationService.AddClientDevice();
                            }
                        }
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

    logout = () => {
        firebase.auth().signOut().then(() => {
            this.setState(startState);
        }).catch(function (error) {
            alert(error.message);
        });
    }

    deleteUser = (event) => {
        event.preventDefault();
        if (!this.state.deleteProcessStarted) {
            this.setState({ deleteProcessStarted: true });
            return;
        }
        let userId = this.state.user.uid;
        let email = this.state.user.email;
        let pass = event.target[0].value;
        firebase.auth().signInWithEmailAndPassword(email, pass)
            .then(async () => {
                await this.spritjaktClient.DeleteUserDoc(userId);
                this.state.user.delete().then(async () => {
                    this.setState(startState);
                }).catch(function (error) {
                    alert("Noe gikk galt, brukeren ble ikke slettet. Feilmelding: " + error.message);
                })
            })
            .catch(function (error) {
                alert("Feil passord");
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
                storeNames.push(this.state.stores.find(s => s.storeId === id).storeName);
            });

            items.push(<li className="filter">
                <div className="operations">
                    <button className="iconBtn dark" onClick={() => { this.applyFilter(filter) }} >
                        <FontAwesomeIcon icon={faFilter} />
                    </button>
                </div>
                <div className="details">
                    <div className="stores">{storeNames.length > 0 ? storeNames.join().replace(/,/g, ", ") : "Alle"}</div>
                    <div className="productTypes">{filter.productTypes.length > 0 ? filter.productTypes.join().replace(/,/g, ", ") : "Alle"}</div>
                </div>
                <div className="operations">
                    <button className="iconBtn dark" onClick={() => { this.spritjaktClient.RemoveUserFilter(filter) }} >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </li>);
        }
        return items;
    }

    handleNotifications = (checkbox) => {
        const field = checkbox.currentTarget.name;
        const checked = checkbox.currentTarget.checked;
        let notifications = this.state.notifications;
        notifications[field] = checked;
        this.spritjaktClient.UpdateUserNotifications(notifications);
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
                    <div className="profileStatusBar">
                        <div>Hei <span className="userEmail">{this.state.userData?.name}</span>!</div>
                        <button aria-label="Vis innstillinger" name="Togglesettings" onClick={() => this.toggleSection(!this.state.isActive)} className="iconBtn toggleSettings">
                            <FontAwesomeIcon size="lg" icon={faBars} />
                        </button>
                    </div>
                }
                {user && userData &&
                    <div className={"notificationSettings " + (this.state.isActive ? " active " : "")} >
                        <div className="sectionHeader toolbar">
                            <button aria-label="Skjul innstillinger" name="Togglesettings" onClick={() => this.toggleSection(!this.state.isActive)} className="iconBtn toggleSettings">
                                <FontAwesomeIcon size="lg" icon={faTimesCircle} />
                            </button>
                            <div>Logget inn som <span className="userName">{this.state.userData?.name}</span></div>
                            <button name="logout" onClick={this.logout} className="bigGreenBtn clickable logout">Logg ut</button>
                        </div>

                        {userData.filters && userData.filters.length > 0 ?
                            <div className="filters">
                                <div className="sectionHeader">
                                    <h3>Lagrede filtre ({this.state.userData.filters.length})</h3>
                                </div>
                                <ul className="list filters">
                                    <li className="listHeaders filter">
                                        <div className="operations">
                                        </div>
                                        <div className="details">
                                            <div className="stores">Butikker</div>
                                            <div className="productTypes">Varetyper</div>
                                        </div>
                                        <div className="operations">
                                        </div>
                                    </li>
                                    {this.renderFilters()}
                                </ul>
                            </div>
                            :
                            <div className="filters">
                                <div className="sectionHeader">
                                    <h3>Lagrede filtre</h3>
                                </div>
                                <p>De lagrede filtrene dine vil dukke opp her.</p>
                            </div>
                        }
                        <br />
                        <hr />
                        {productResult.length > 0 ?
                            <div className="favorites">
                                <div className="sectionHeader">
                                    <h3>Favoritter ({this.state.productResult.length})</h3>
                                </div>
                                <ul className="list miniproducts">{this.renderProducts()}</ul>
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
                        <br />
                        <hr />
                        <div className="heading">
                            <h2>Kontoinnstillinger</h2>
                            <h3>Varsler</h3>
                            <label><input type="checkbox" checked={this.state.notifications.onAll} onChange={this.handleNotifications} name="onAll" /> Ved alle prisendringer</label><br />
                            <label><input type="checkbox" onChange={this.handleNotifications} checked={this.state.notifications.onFilters} name="onFilters" /> Ved prisendringer i lagrede filtre</label><br />
                            <label><input type="checkbox" onChange={this.handleNotifications} checked={this.state.notifications.onFavorites} name="onFavorites" /> Ved prisendringer i favoritter</label><br />
                            <p>
                                <strong>Hvordan vil du bli varslet?</strong>
                            </p>
                            <label><input type="checkbox" name="byPush" checked={this.state.notifications.byPush} onChange={this.handleNotifications} /> Push-varsler (Ikke på iPhone)</label><br />
                            <label><input type="checkbox" name="byEmail" checked={this.state.notifications.byEmail} onChange={this.handleNotifications} /> Epost</label>
                            <div>
                                <br />
                                <h3>Slett konto</h3>
                                <div className="deleteWarning">
                                    <form onSubmit={this.deleteUser} >
                                        {this.state.deleteProcessStarted ?
                                            <label>
                                                Oppgi passord for å bekrefte sletting
                                            <input type="password" name="password" />
                                            </label>
                                            :
                                            <span>Lagrede filtre og favoritter vil slettes, og du vil ikke lenger kunne logge inn med denne kontoen.<br /><strong>Denne handlingen kan ikke angres.</strong></span>
                                        }
                                        {this.state.deleteProcessStarted &&
                                            <button className="clickable" onClick={() => { this.setState({ deleteProcessStarted: false }) }}>Tilbake</button>
                                        }
                                        <input type="submit" className="bigRedBtn clickable" value="Slett konto" />
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div >

                }
            </div>
        );
    }
}

export default NotificationSettings;
