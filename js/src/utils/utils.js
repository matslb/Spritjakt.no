import googleImg from "../assets/google.png";
import appleImg from "../assets/apple.svg";
import emailImg from "../assets/email.svg";
import firebase from "firebase/compat/app";
import { createTheme } from "@mui/material/styles";
import {
  faDiceOne,
  faDiceTwo,
  faDiceThree,
  faDiceFour,
  faDiceFive,
  faDiceSix,
} from "@fortawesome/free-solid-svg-icons";

export const arraysAreEqual = (arr1, arr2) => {
  if (arr1?.length !== arr2?.length) {
    return false;
  }
  for (const x of arr1) {
    if (!arr2.includes(x)) {
      return false;
    }
  }
  return true;
};

export const formatDate = (date) => {
  date.setHours(date.getHours() + 2);
  return date.toISOString().slice(0, 10);
};

export const toArray = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

export const cleanForMissingValues = (array, master) =>
  array.filter((x) => master[x]);

export const cleanForMissingStores = (array, master) =>
  array.filter((x) => master.some((s) => s.storeId === x));

export function debouncer(fn, delay) {
  let timeoutID = null;
  return (e) => {
    clearTimeout(timeoutID);
    timeoutID = window.setTimeout(() => fn.apply(this, [e]), delay);
  };
}

export function getImageUrl(id, size) {
  return `https://bilder.vinmonopolet.no/cache/${size}x${size}-0/${id}-1.jpg`;
}

export const formTypes = {
  register: "Registrer deg",
  login: "Logg inn",
  resetPass: "Tilbakestill passord",
};

export const providers = {
  google: "Google",
  email: "e-post",
};

export const getProviderAuth = (provider) => {
  switch (provider.replace(".com", "")) {
    case providers.google:
      return new firebase.auth.GoogleAuthProvider();
    default:
      return null;
  }
};
export const getProviderImg = (provider) => {
  switch (provider) {
    case providers.google:
      return googleImg;
    default:
      return emailImg;
  }
};

export const iosCopyToClipboard = (href) => {
  var input = document.createElement("input");
  document.body.appendChild(input);
  input.setAttribute("value", href);

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

  document.execCommand("copy");
  document.body.removeChild(input);
};

export const sortOptions = [
  {
    label: "Siste prisfall",
    value: "latest_discount",
    typeSenseValue: "PriceIsLowered:desc, LastUpdated:desc , PriceChange:asc",
  },
  {
    label: "Sist oppdatert",
    value: "new",
    typeSenseValue: "_text_match:desc, LastUpdated:desc, PriceChange:asc",
  },
  {
    label: "Største prisfall",
    value: "discounted",
    typeSenseValue: "_text_match:desc, PriceChange:asc",
  },
  {
    label: "Vurdering",
    value: "rating",
    typeSenseValue: "_text_match:desc, VivinoRating:desc",
  },
  {
    label: "Gjerrigknark - Literpris ",
    value: "cheapskate",
    typeSenseValue: "_text_match:desc, Literprice:asc",
  },
  {
    label: "Student - Billigst fyll",
    value: "student",
    typeSenseValue: "_text_match:desc, LiterPriceAlcohol:asc",
  },
  {
    label: "Laveste pris",
    value: "price_low",
    typeSenseValue: "_text_match:desc, LatestPrice:asc",
  },
  {
    label: "Høyeste pris",
    value: "price_high",
    typeSenseValue: "_text_match:desc, LatestPrice:desc",
  },
];

export const volumeOptions = [
  { label: "Under 20 cl", value: "<20" },
  { label: "20 - 33 cl", value: "20..33" },
  { label: "34 - 49 cl", value: "34..49" },
  { label: "50 - 69 cl", value: "50..69" },
  { label: "70 - 74 cl", value: "70..74" },
  { label: "75 - 99 cl", value: "75..99" },
  { label: "1 - 2,9 liter", value: "100..290" },
  { label: "3 liter og over", value: ">=300" },
];

export const isInViewport = (element) => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};
export const formatPriceHistory = (p) => {
  if (p.PriceHistorySorted == undefined) return p;

  if (p["PriceHistory." + [p.PriceHistorySorted[0]]] != undefined) return p;

  for (const date of p.PriceHistorySorted) {
    p["PriceHistory." + date] = p.PriceHistory[date];
  }
  return p;
};

export const theme = createTheme({
  palette: {
    primary: {
      light: "#283438",
      main: "#132328",
      dark: "#101b1f",
      contrastText: "#fff",
    },
    secondary: {
      light: "#ff7961",
      main: "#f44336",
      dark: "#ba000d",
      contrastText: "#000",
    },
  },
});

export const getDiceIcon = (rating) => {
  // Ensure the rating is within the 1-6 scale
  const minRating = 1;
  const maxRating = 6;

  // Clamp the rating between 1 and 6
  rating = Math.min(Math.max(rating, minRating), maxRating);

  // Round the rating to the nearest integer
  const roundedRating = Math.round(rating);

  // Map the rounded rating to the Font Awesome dice icon name
  const iconNames = {
    1: faDiceOne,
    2: faDiceTwo,
    3: faDiceThree,
    4: faDiceFour,
    5: faDiceFive,
    6: faDiceSix,
  };

  return iconNames[roundedRating];
};
