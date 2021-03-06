import React from "react";
import "./css/accountSettings.css";
import SpritjaktClient from "../services/spritjaktClient";
import MiniProduct from "./MiniProduct";
import { faTrash, faTimesCircle, faBars, faFilter, faPen, faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import firebase from "firebase/app";
import "firebase/analytics";
import ProductPopUp from "./ProductPopUp";
import queryString from "query-string";
import NotificationService from "../services/notificationService";
import Notification from "./Notification";
import LoginForm from "./LoginForm";

const startState = {
    isActive: false,
    resultMessage: "",
    user: null,
    stores: [],
    userData: false,
    newName: "",
    isLoading: false,
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

class AccountSettings extends React.Component {
    constructor(props) {
        super(props);
        this.state = startState;
        this.spritjaktClient = new SpritjaktClient();
        this.notificationService = new NotificationService();
        this.Notification = React.createRef();
    }

    componentDidMount() {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.settings) {
            this.toggleSection(true)
        }
        firebase.auth().onAuthStateChanged((user) => {
            this.setState({ productResult: [] });
            if (user) {
                firebase.firestore().collection("Users").doc(user.uid)
                    .onSnapshot(async (doc) => {
                        let userData = doc.data();
                        if (userData) {
                            if (userData.products && userData.products.length > 0) {
                                this.setState({ isLoading: true });
                                this.spritjaktClient.FetchProductsById(userData.products).then(products => {
                                    this.setState({ productResult: products, isLoading: false });
                                });
                            } else {
                                this.setState({ productResult: [] });
                            }

                            this.spritjaktClient.FetchStores().then(stores => {
                                stores.push({ storeName: "vinmonopolet.no", storeId: "online" });
                                this.setState({ stores: stores });
                            });
                            this.setState({
                                user: user,
                                userData: userData,
                                notifications: userData.notifications
                            });

                            if (userData.notifications.byPush) {
                                this.notificationService.AddClientDevice();
                            } else {
                                this.spritjaktClient.PurgeUserNotificationTokens();
                            }
                        } else {
                            await this.spritjaktClient.CreateUserDoc(user.email, startState.notifications);
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
        if (isActive) {
            window.history.pushState('', '', '?' + query);
        } else {
            window.history.replaceState('', '', '?' + query);
        }
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
        event = Object.assign({}, event);
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
            .catch((error) => {
                this.Notification.current.setNotification(event, "Feil passord", "error");
            });
    }

    renderProducts() {
        let items = [];
        for (const product of this.state.productResult) {
            items.push(<MiniProduct key={product.Id} product={product} notification={this.Notification} setGraph={this.setGraph.bind(this)} removeProduct={() => { this.spritjaktClient.RemoveProductFromUser(product.Id) }} />);
        }
        return items;
    }

    applyFilter = (filter) => {
        let urlParams = {};

        urlParams.stores = filter.stores;
        urlParams.types = filter.productTypes;
        urlParams.countries = filter.countries;

        let query = queryString.stringify(urlParams, { arrayFormat: 'comma' });
        window.history.replaceState('', '', '?' + query);
        this.props.applyUserFilter();
        firebase.analytics().logEvent("user_apply_filter");
    }


    renderFilters() {
        let items = [];
        for (const filter of this.state.userData.filters) {

            let storeNames = [];
            if (this.state.stores && filter.stores) {
                filter.stores.forEach(id => {
                    storeNames.push(this.state.stores.find(s => s.storeId === id)?.storeName);
                });
            }

            items.push(<li key={this.state.userData.filters.indexOf(filter)} className="filter">
                <div className="operations">
                    <button aria-label="Sett filter" className="iconBtn dark" onClick={(e) => {
                        this.applyFilter(filter);
                        this.Notification.current.setNotification(e, "Filter satt", "success");
                    }} >
                        <FontAwesomeIcon icon={faFilter} />
                    </button>
                </div>
                <div className="details">
                    <div className="stores">{storeNames.length > 0 ? storeNames.join().replace(/,/g, ", ") : "Alle"}</div>
                    <div className="productTypes">{filter.productTypes.length > 0 ? filter.productTypes.join().replace(/,/g, ", ") : "Alle"}</div>
                    <div className="countries">{filter.countries?.length > 0 ? filter.countries?.join().replace(/,/g, ", ") : "Alle"}</div>
                </div>
                <div className="operations">
                    <button aria-label="Slett filter" className="iconBtn dark" onClick={(e) => {
                        this.spritjaktClient.RemoveUserFilter(filter);
                        this.Notification.current.setNotification(e, "Fjernet", "success");
                    }} >
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
        this.Notification.current.setNotification(checkbox, "Lagret", "success");
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

    changeName = (e) => {
        this.spritjaktClient.ChangeUserName(this.state.newName);
        this.setState({ changeName: false });
    }

    render() {
        let { user, userData, productResult, isLoading } = this.state;
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
                    <div className={"account-settings " + (this.state.isActive ? " active " : "")} >
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
                                            <div className="productTypes">Typer</div>
                                            <div className="productTypes">Land</div>
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
                        <div className="favorites">
                            <div className="sectionHeader">
                                <h3>Favoritter
                                    {productResult && productResult.length > 0 ? ` (${productResult.length})` : ""}
                                </h3>
                            </div>
                            {productResult && productResult.length > 0 &&
                                <ul className="list miniproducts">{this.renderProducts()}</ul>
                            }
                            {userData.products && userData.products.length === 0 &&
                                <p>Her listes favorittproduktene dine opp.</p>
                            }
                            {isLoading && userData.products && userData.products.length > 0 && productResult.length === 0 &&
                                <FontAwesomeIcon icon={faCircleNotch} size="3x" />
                            }

                        </div>
                        <ProductPopUp product={this.state.highlightedProduct} notification={this.Notification} graphIsVisible={this.state.graphIsVisible} nextProduct={this.nextProduct.bind(this)} setGraph={this.setGraph.bind(this)} />
                        <br />
                        <hr />
                        <div className="heading">
                            <h2>Kontoinnstillinger</h2>
                            <h3>Brukernavn</h3>
                            {this.state.changeName ?
                                <div className="changeName">
                                    <input type="text" name="name" onChange={(e) => { this.setState({ newName: e.currentTarget.value }) }} />
                                    <button className="bigWhiteBtn clickable" onClick={() => { this.setState({ changeName: false }) }}>Tilbake</button>
                                    <button name="changeName" disabled={this.state.newName.length === 0} onClick={this.changeName} className="bigGreenBtn clickable">Lagre</button>
                                </div>
                                :
                                <div className="changeName">
                                    {userData.name}
                                    <button aria-label="Endre navn" className="iconBtn clickable" onClick={() => { this.setState({ changeName: true }) }} ><FontAwesomeIcon size="lg" icon={faPen} /></button>
                                </div>
                            }
                            <h3>Varsler</h3>
                            <label><input type="checkbox" checked={this.state.notifications.onAll} onChange={this.handleNotifications} name="onAll" /> Ved alle prisendringer</label><br />
                            <label><input type="checkbox" onChange={this.handleNotifications} checked={this.state.notifications.onFilters} name="onFilters" /> Ved prisendringer i lagrede filtre</label><br />
                            <label><input type="checkbox" onChange={this.handleNotifications} checked={this.state.notifications.onFavorites} name="onFavorites" /> Ved prisendringer i favoritter</label><br />
                            <p>
                                <strong>Hvordan vil du bli varslet?</strong>
                            </p>
                            <label><input type="checkbox" name="byPush" checked={this.state.notifications.byPush} onChange={this.handleNotifications} /> Push-varsler (Ikke p?? iPhone)</label><br />
                            <label><input type="checkbox" name="byEmail" checked={this.state.notifications.byEmail} onChange={this.handleNotifications} /> E-post</label>
                            <div>
                                <br />
                                <h3>Slett konto</h3>
                                <div className="deleteWarning">
                                    <form onSubmit={this.deleteUser} >
                                        {this.state.deleteProcessStarted ?
                                            <label>
                                                Oppgi passord for ?? bekrefte sletting
                                            <input type="password" aria-label="passord" name="password" />
                                            </label>
                                            :
                                            <span>Lagrede filtre og favoritter vil slettes, og du vil ikke lenger kunne logge inn med denne kontoen.<br /><strong>Denne handlingen kan ikke angres.</strong></span>
                                        }
                                        {this.state.deleteProcessStarted &&
                                            <button className="clickable bigWhiteBtn" onClick={() => { this.setState({ deleteProcessStarted: false }) }}>Tilbake</button>
                                        }
                                        <input type="submit" className="bigRedBtn clickable" value="Slett konto" />
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div >
                }
                <Notification ref={this.Notification} />
            </div>
        );
    }
}

export default AccountSettings;
