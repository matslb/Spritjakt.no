import React, { useState, useEffect, useCallback } from "react";
import "./css/accountSettings.css";
import MiniProduct from "./MiniProduct";
import { faTrash, faTimesCircle, faBars, faFilter, faPen, faCircleNotch, faExclamationCircle, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import firebase from "firebase/app";
import "firebase/analytics";
import ProductPopUp from "./ProductPopUp";
import queryString from "query-string";
import NotificationService from "../services/notificationService";
import Notification from "./Notification";
import { getProviderAuth } from "../utils/utils";
import { NotificationSection, handleSubmitEvent } from "./NotificationSection";
import SpritjaktClient from "../services/spritjaktClient";
import UserCacher from "../services/userCache";

const defaultPermissions = {
    onAll: false,
    onFilters: false,
    onFavorites: false,
    byPush: false,
    byEmail: false,
};

const AccountSettings = ({
    applyUserFilter
}) => {

    const [isActive, setIsActive] = useState(false);
    const [user, setUser] = useState(null);
    const [stores, setStores] = useState([]);
    const [isFirstLogin, setIsFirstLogin] = useState();
    const [registrationError, setRegistrationError] = useState();
    const [userData, setUserData] = useState(UserCacher.get());
    const [newName, setNewName] = useState(null);
    const [nameChange, setNameChange] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlightedProduct, setHighlightedProduct] = useState(null);
    const [deleteProcessStarted, setDeleteProcess] = useState(false);
    const [productResult, setProductResult] = useState([]);
    const [permissions, setPermissions] = useState(defaultPermissions);
    const notificationService = useCallback(new NotificationService(), []);
    const notification = React.createRef();
    const [showContent, setShowContent] = useState(false);

    const setNotifications = async (event) => {
        event.preventDefault();
        await SpritjaktClient.UpdateUserNotifications(handleSubmitEvent(event));
    }

    useEffect(() => {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.settings) {
            toggleSection(true)
        }
        firebase.auth()
            .getRedirectResult()
            .then(async (result) => {
                if (result.credential) {
                    var user = result.user;
                    firebase.firestore().collection("Users").doc(user.uid)
                        .get().then(async (doc) => {
                            if (!doc.exists) {
                                setIsFirstLogin(true);
                                await SpritjaktClient.CreateUserDoc(user.displayName.split(" ")[0], handleSubmitEvent());
                                firebase.analytics().logEvent("user_registration");
                            }
                        })
                }
            }).catch((error) => {
                setRegistrationError(error.message);
                console.error(error);
            });

        firebase.auth().onAuthStateChanged((user) => {
            setProductResult([]);
            if (user) {
                firebase.firestore().collection("Users").doc(user.uid)
                    .onSnapshot(async (doc) => {
                        let userData = doc.data();
                        if (userData) {
                            UserCacher.set(userData);
                            if (userData.products && userData.products.length > 0) {
                                setIsLoading(true);
                                SpritjaktClient.FetchProductsById(userData.products).then(products => {
                                    setIsLoading(false);
                                    setProductResult(products);
                                });
                            } else {
                                setProductResult([]);
                            }
                            SpritjaktClient.FetchStores().then(stores => {
                                stores.push({ storeName: "vinmonopolet.no", storeId: "online" });
                                setStores(stores);
                            });
                            setUser(user);
                            setUserData(userData);
                            setPermissions(userData.notifications);

                            if (userData.notifications.byPush) {
                                notificationService.AddClientDevice();
                            } else {
                                SpritjaktClient.PurgeUserNotificationTokens();
                            }
                        }
                    });
            }
        });
    }, [notificationService, SpritjaktClient]);

    const toggleSection = (isActive) => {
        let parsed = queryString.parse(window.location.search);
        parsed.settings = isActive;
        if (!isActive) {
            delete parsed.settings;
        }
        let query = queryString.stringify(parsed, { arrayFormat: 'comma' });
        if (isActive) {
            window.history.replaceState('', '', '?' + query);
            setShowContent(true);
        } else {
            window.history.replaceState('', '', '?' + query);
            setTimeout(() => setShowContent(false), 300);
        }
        setIsActive(isActive);
    }

    const logout = () => {
        firebase.auth().signOut().then(() => {
            UserCacher.delete();
            resetComponent();
        }).catch(function (error) {
            alert(error.message);
        });
    }

    const resetComponent = () => {
        setIsActive(false);
        setUser(null);
        setStores([]);
        setUserData(null);
        setNewName(null);
        setIsLoading(false);
        setHighlightedProduct(null);
        setDeleteProcess(false);
        setProductResult([]);
        setPermissions(defaultPermissions);
    }

    const deleteUser = (event) => {
        event.preventDefault();
        event = Object.assign({}, event);
        if (!deleteProcessStarted) {
            setDeleteProcess(true);
            return;
        }
        let userId = user.uid;
        let email = user.email;
        let pass = event.target[0].value;

        if (user.providerData[0].providerId !== "password") {
            if (pass !== "SLETT") {
                notification.current.setNotification(event, "Skriv SLETT for å slette brukeren din.", "error");
                return;
            }
            const provider = getProviderAuth(user.providerData[0].providerId);
            firebase.auth()
                .signInWithPopup(provider)
                .then(async () => {
                    await deleteUserDoc(userId, event);
                }).catch(() => {
                    notification.current.setNotification(event, "Noe gikk galt, det kan hende du må tillate pop-ups.", "error");
                })
        } else {
            firebase.auth().signInWithEmailAndPassword(email, pass)
                .then(async () => {
                    await deleteUserDoc(userId, event);
                })
                .catch((error) => {
                    notification.current.setNotification(event, "Feil passord", "error");
                });
        }
    }

    const deleteUserDoc = async (userId, event) => {
        await SpritjaktClient.DeleteUserDoc(userId);
        user.delete().then(async () => {
            notification.current.setNotification(event, "Brukeren ble slettet", "success");
            resetComponent();
        }).catch(function (error) {
            alert("Noe gikk galt, brukeren ble ikke slettet. Feilmelding: " + error.message);
        })
    }

    const renderProducts = () => {
        let items = [];
        for (const product of productResult) {
            items.push(<MiniProduct
                key={product.Id}
                product={product}
                notification={notification}
                highlightProduct={highlightProduct.bind(this)}
                removeProduct={removeProduct}
            />);
        }
        return items;
    }

    const removeProduct = (id) => {
        SpritjaktClient.RemoveProductFromUser(id);
        setProductResult(productResult.filter(p => p.Id !== id));
    }

    const applyFilter = (filter) => {
        let query = queryString.parse(window.location.search, { arrayFormat: 'comma' });
        query.stores = filter.stores;
        query.types = filter.productTypes;
        query.countries = filter.countries;

        let params = queryString.stringify(query, { arrayFormat: 'comma' });
        window.history.replaceState('', '', '?' + params);
        applyUserFilter();
        firebase.analytics().logEvent("user_apply_filter");
    }

    const renderFilters = () => {
        let items = [];
        for (const filter of userData.filters) {

            let storeNames = [];
            if (stores && filter.stores) {
                filter.stores.forEach(id => {
                    storeNames.push(stores.find(s => s.storeId === id)?.storeName);
                });
            }

            items.push(<li key={userData.filters.indexOf(filter)} className="filter">
                <div className="operations">
                    <button aria-label={"Velg filter. Butikker: " + storeNames + ". Produkttyper: " + filter.productTypes.join() + ". Land: " + filter.countries.join() + "."} className="iconBtn dark" onClick={(e) => {
                        applyFilter(filter);
                        notification.current.setNotification(e, "Filter satt", "success");
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
                        SpritjaktClient.RemoveUserFilter(filter);
                        notification.current.setNotification(e, "Fjernet", "success");
                    }} >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </li>);
        }
        return items;
    }

    const handleNotifications = (checkbox) => {
        const field = checkbox.currentTarget.name;
        const checked = checkbox.currentTarget.checked;
        let notifications = permissions;
        notifications[field] = checked;
        notification.current.setNotification(checkbox, "Lagret", "success");
        SpritjaktClient.UpdateUserNotifications(notifications);
    }

    const nextProduct = (change) => {
        let highlightedProductIndex = productResult.indexOf(highlightedProduct);
        let newHighlightedProduct = productResult[highlightedProductIndex + change] ?? null;
        highlightProduct(null);
        if (newHighlightedProduct) {
            highlightProduct(newHighlightedProduct.Id);
        }
    }

    const highlightProduct = async (productId) => {
        if (productId === null || productId === highlightedProduct?.Id) {
            setHighlightedProduct(null);
        } else {
            let product = productResult.find((p) => p.Id === productId) || await SpritjaktClient.FetchProductById(productId);
            setHighlightedProduct(product);
        }
    };

    const changeName = (e) => {
        SpritjaktClient.ChangeUserName(newName);
        setNameChange(false);
        setNewName(null);
    }

    return (
        <div>
            {userData &&
                <div className="profileStatusBar">
                    <button aria-label="Vis innstillinger" name="Togglesettings" onClick={() => toggleSection(!isActive)} className="iconBtn toggleSettings">
                        <FontAwesomeIcon size="lg" icon={faBars} />
                        <span className="user-name">{userData.name}</span>
                    </button>
                </div>
            }
            {userData &&
                <div className={"account-settings " + (isActive ? " active " : "")} >
                    {showContent && <div>
                        <div className="sectionHeader toolbar">
                            <button aria-label="Skjul innstillinger" name="Togglesettings" onClick={() => toggleSection(!isActive)} className="iconBtn toggleSettings">
                                <FontAwesomeIcon size="lg" icon={faTimesCircle} />
                            </button>
                            <div>Logget inn som <span className="userName">{userData?.name}</span></div>
                            <button name="logout" onClick={logout} className="bigGreenBtn clickable logout">Logg ut</button>
                        </div>

                        {userData.filters && userData.filters.length > 0 ?
                            <div className="filters">
                                <div className="sectionHeader">
                                    <h3>Lagrede filtre ({userData.filters.length})</h3>
                                </div>
                                <ul className="list filters">
                                    <li className="listHeaders filter">
                                        <div className="operations">
                                        </div>
                                        <div className="details">
                                            <div className="stores">Butikker</div>
                                            <div className="productTypes">Typer</div>
                                            <div className="productCountries">Land</div>
                                        </div>
                                        <div className="operations">
                                        </div>
                                    </li>
                                    {renderFilters()}
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
                                <ul className="list miniproducts">{renderProducts()}</ul>
                            }
                            {userData.products && (productResult.length < 1 || productResult === undefined) &&
                                <p>Her listes favorittproduktene dine opp.</p>
                            }
                            {isLoading && userData.products && userData.products.length > 0 && productResult.length === 0 &&
                                <FontAwesomeIcon icon={faCircleNotch} size="3x" />
                            }

                        </div>
                        <ProductPopUp product={highlightedProduct} notification={notification} nextProduct={nextProduct.bind(this)} highlightProduct={highlightProduct.bind(this)} />
                        <br />
                        <hr />
                        <div className="heading">
                            <h2>Kontoinnstillinger</h2>
                            <h3>Brukernavn</h3>
                            {nameChange ?
                                <div className="changeName">
                                    <input type="text" name="name" onChange={(e) => { setNewName(e.currentTarget.value) }} />
                                    <button className="bigWhiteBtn clickable" onClick={() => { setNameChange(false) }}>Tilbake</button>
                                    <button name="changeName" disabled={newName === null} onClick={changeName} className="bigGreenBtn clickable">Lagre</button>
                                </div>
                                :
                                <div className="changeName">
                                    {userData.name}
                                    <button aria-label="Endre navn" className="iconBtn clickable dark" onClick={() => { setNameChange(true) }} ><FontAwesomeIcon size="lg" icon={faPen} /></button>
                                </div>
                            }
                            <h3>Varsler</h3>
                            <label><input type="checkbox" checked={permissions.onAll} onChange={handleNotifications} name="onAll" /> Ved alle prisendringer</label><br />
                            <label><input type="checkbox" onChange={handleNotifications} checked={permissions.onFilters} name="onFilters" /> Ved prisendringer i lagrede filtre</label><br />
                            <label><input type="checkbox" onChange={handleNotifications} checked={permissions.onFavorites} name="onFavorites" /> Ved prisendringer i favoritter</label><br />
                            <h4>Hvordan vil du bli varslet?</h4>

                            <label><input type="checkbox" name="byPush" checked={permissions.byPush} onChange={handleNotifications} /> Push-varsler (Ikke på iPhone)</label><br />
                            <label><input type="checkbox" name="byEmail" checked={permissions.byEmail} onChange={handleNotifications} /> E-post</label>
                            <div>
                                <br />
                                <h3>Slett konto</h3>
                                <div className="deleteWarning">
                                    <form onSubmit={deleteUser} >
                                        {deleteProcessStarted && user?.providerData?.length > 0 ?
                                            <label>
                                                {user.providerData[0].providerId !== "password" ?
                                                    <span>
                                                        Skriv SLETT for å bekrefte sletting
                                                        <input type="text" aria-label="Skriv SLETT for å bekrefte sletting" name="password" />
                                                    </span>
                                                    :
                                                    <span>
                                                        Oppgi passord for å bekrefte sletting
                                                        <input type="password" aria-label="Oppgi passord for å bekrefte sletting" name="password" />
                                                    </span>
                                                }
                                            </label>
                                            :
                                            <span>Lagrede filtre og favoritter vil slettes, og du vil ikke lenger kunne logge inn med denne kontoen.<br /><strong>Denne handlingen kan ikke angres.</strong></span>
                                        }
                                        {deleteProcessStarted &&
                                            <button className="clickable bigWhiteBtn" onClick={() => { setDeleteProcess(false) }}>Tilbake</button>
                                        }
                                        <input type="submit" className="bigRedBtn clickable" value="Slett konto" />
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                    }
                </div >
            }¨
            {(isFirstLogin || registrationError) &&
                <div className="loginNotification">
                    {isFirstLogin &&
                        <div className="notificationForm">
                            <h2>Velkommen til Spritjakt!</h2>
                            <form onSubmit={setNotifications}
                                onChange={(e) => { e.currentTarget.dispatchEvent(new Event('submit')) }}>
                                <NotificationSection />
                            </form>
                            <button onClick={() => { setIsFirstLogin(false) }} style={{ margin: "auto" }} className="clickable bigGreenBtn">
                                Ferdig
                            </button>
                        </div>
                    }
                    {registrationError &&
                        <div className={"statusMessage error"}>
                            <FontAwesomeIcon icon={faExclamationCircle} />
                            {registrationError}
                            <button onClick={() => { setRegistrationError("") }} className="clickable iconBtn dark">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    }

                </div>
            }
            <Notification ref={notification} />
        </div>
    );
}

export default AccountSettings;
