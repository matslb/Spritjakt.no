import googleImg from "../assets/google.png";
import facebookImg from "../assets/facebook.png";
import appleImg from "../assets/apple.svg";
import emailImg from "../assets/email.svg";
import firebase from "firebase/compat/app";


export const arraysAreEqual = (arr1, arr2) => {
    if (arr1?.length !== arr2?.length) {
        return false;
    }
    for (const x of arr1) {
        if (!arr2.includes(x)) {
            return false
        }
    }
    return true;
}

export const formatDate = (date) => {
    date.setHours(date.getHours() + 2);
    return date.toISOString().slice(0, 10);
};

export const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : [])

export const cleanForMissingValues = (array, master) => (array.filter(x => master[x]))

export const cleanForMissingStores = (array, master) => (array.filter(x => master.some(s => s.storeId === x)))

export function debouncer(fn, delay) {
    let timeoutID = null;
    return e => {
        clearTimeout(timeoutID);
        timeoutID = window.setTimeout(() => fn.apply(this, [e]), delay);
    };
}

export function getImageUrl(id, size) {
    return "https://bilder.vinmonopolet.no/cache/" + size + "x" + size + "/" + id + "-1.jpg";
}

export const formTypes = {
    register: "Registrer deg",
    login: "Logg inn",
    resetPass: "Tilbakestill passord"
}

export const providers = {
    google: "google",
    facebook: "facebook",
    email: "epost"
}

export const getProviderAuth = (provider) => {
    switch (provider.replace(".com", "")) {
        case providers.google:
            return new firebase.auth.GoogleAuthProvider();
        case providers.facebook:
            return new firebase.auth.FacebookAuthProvider();
        default:
            return null;
    }
}
export const getProviderImg = (provider) => {
    switch (provider) {
        case providers.google:
            return googleImg;
        case providers.facebook:
            return facebookImg;
        case providers.apple:
            return appleImg;
        default:
            return emailImg;
    }
}

export const iosCopyToClipboard = (href) => {
    var input = document.createElement("input");
    document.body.appendChild(input);
    input.setAttribute('value', href);

    var isiOSDevice = navigator.userAgent.match(/ipad|iphone/i);

    if (isiOSDevice) {

        var editable = input.contentEditable;
        var readOnly = input.readOnly;

        input.contentEditable = true;
        input.readOnly = false;

        var range = document.createRange();
        range.selectNodeContents(input);

        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        input.setSelectionRange(0, 999999);
        input.contentEditable = editable;
        input.readOnly = readOnly;

        document.body.removeChild(input);
    } else {
        input.select();
    }

    document.execCommand('copy');
    document.body.removeChild(input);
}

export const sortOptions = [
    { label: "Nyeste tilbud", value: "new_discount", typeSenseValue: "_text_match:desc, LastUpdated:desc, PriceChange:asc" },
    { label: "Nylig lagt til (nyheter)", value: "new", typeSenseValue: "_text_match:desc, PriceChanges:asc,  LastUpdated:desc" },
    { label: "Nyeste prisøkninger", value: "new_raised", typeSenseValue: "_text_match:desc, LastUpdated:desc, PriceChange:desc" },
    { label: "Beste tilbud", value: "discounted", typeSenseValue: "_text_match:desc, PriceChange:asc" },
    { label: "Største prisøkning", value: "raised", typeSenseValue: "_text_match:desc, PriceChange:desc" },
    { label: "Vurdering (aperitif.no)", value: "rating", typeSenseValue: "_text_match:desc, Rating:desc" },
    { label: "Gjerrigknark - Literpris ", value: "cheapskate", typeSenseValue: "_text_match:desc, Literprice:asc" },
    { label: "Student - Mest alkohol for penga", value: "student", typeSenseValue: "_text_match:desc, LiterPriceAlcohol:asc" },
    { label: "Laveste pris", value: "price_low", typeSenseValue: "_text_match:desc, LatestPrice:asc" },
    { label: "Høyeste pris", value: "price_high", typeSenseValue: "_text_match:desc, LatestPrice:desc" },

];

export const isInViewport = (element) => {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}
export const formatPriceHistory = (p) => {
    if (p.PriceHistorySorted == undefined)
        return p;

    if (p["PriceHistory." + [p.PriceHistorySorted[0]]] != undefined) return p;

    for (const date of p.PriceHistorySorted) {
        p["PriceHistory." + date] = p.PriceHistory[date];
    }
    return p;
}