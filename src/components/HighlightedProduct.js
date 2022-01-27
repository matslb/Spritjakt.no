import React, { useState, useEffect, useCallback } from "react";
import "./css/highlightedProduct.css";
import { faExternalLinkAlt, faHeart, faLink, faSeedling, faStar } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SpritjaktClient from "../services/spritjaktClient";
import firebase from "firebase/app";
import { getImageUrl } from "../utils/utils.js";
import PriceGraph from "./PriceGraph";
import copy from 'copy-to-clipboard';
import StoreCacher from "../services/storeCache";
import debounce from "lodash.debounce";
import emptyGraph from "../assets/emptyGraph.png";
import { isMobile } from "react-device-detect";

const HighlightedProduct = ({
  product,
  notification
}) => {

  const [user, setUser] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showGraph, setShowGraph] = useState(!isMobile);
  const background = { backgroundImage: "url(" + getImageUrl(product.Id, 300) + ")" };
  const showDiff = product.PriceChange > 100.1 || product.PriceChange < 99.9;
  const priceIsLower = product.LatestPrice < product.PriceHistory[product.PriceHistorySorted[1]];
  const stores = StoreCacher.get();

  useEffect(() => {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
      } else {
        setIsFavorite(false)
      }
    });
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (showGraph) {
      setShowGraph(false);
    }
    debouncedChangeHandler();
  }, [product]);

  const debouncedChangeHandler = useCallback(debounce(() => setShowGraph(true), 200), [product, 200]);

  useEffect(() => {
    if (!user)
      return;

    firebase.firestore().collection("Users").doc(user.uid)
      .onSnapshot(async (doc) => {
        let userData = doc.data();
        if (userData) {
          let isFavorite = userData.products !== undefined ? userData.products.includes(product.Id) : false;
          setIsFavorite(isFavorite)
        }
      });
  }, [user]);

  const toggleProdctWatch = (e) => {

    if (isFavorite) {
      SpritjaktClient.RemoveProductFromUser(product.Id);
      notification.current.setNotification(e, "Fjernet", "success");

    } else {
      SpritjaktClient.AddProductToUser(product.Id)
      notification.current.setNotification(e, "Lagt til", "success");
    }
    setIsFavorite(!isFavorite);
  }
  const copyLink = (event) => {
    let link = window.location.href.includes("product") ? window.location.href : window.location.origin + "?product=" + product.Id;
    copy(link);
    notification.current.setNotification(event, "Kopiert til utklippstavlen", "success");
    firebase.analytics().logEvent("user_link_copied");
  }

  const createPieChartCss = (value) => {
    return {
      background: "conic-gradient(#2e2e2e 0.00%" + (value * 100 / 12) + "%, white 0%)"
    };
  };

  const renderStoreStock = () => {
    let list = [];
    if (product.Stores.includes("online"))
      list.push(<li key="online">
        <span>Nettlager</span>
        <span>{product.ProductStatusSalename || "Kan bestilles"}</span>
      </li>
      );
    for (const store of stores) {
      let storeStock = product.StoreStock ? product.StoreStock.find(s => s.store == store.value) : product.Stores.find(s => s == store.value);
      if (storeStock && storeStock != "online")
        list.push(<li key={store.value}>
          <span>{store.label.split(" (")[0]}</span>
          <span>{storeStock?.stock || "På lager"}</span>
        </li>
        );
    }

    return list;
  }

  const renderIsGoodFor = () => {
    let foods = [];
    if (product.IsGoodFor)
      for (const food of product.IsGoodFor) {
        foods.push(<li className="food" key={food.code}>
          <div><img src={"/images/icons/" + food.code + ".png"} /></div>
          {food.name}
        </li>);
      }
    return foods;
  }
  const renderRawMaterials = () => {
    let materials = [];
    if (product.RawMaterials)
      for (const material of product.RawMaterials) {
        materials.push(<li className="material" key={material.code}>
          {materials.length === 0 &&
            <FontAwesomeIcon icon={faSeedling} size="lg" />}
          {material.name}{material.percentage && ", " + material.percentage + "%"}
        </li>);
      }
    return materials;
  }
  const renderTasteProfile = (value, label) => {
    return value ? <li className="pieChartWrapper">
      <div aria-label={value} className="pieChart" style={createPieChartCss(value)}></div>
      {label}
    </li> : null
  }

  const renderTextSection = (text, label) => {
    return text ? <p className="descriptionText">
      <span>{label}</span>
      {text}
    </p> : null
  }

  return (
    <div
      id={product.Id}
      className={
        "HighlightedProduct " +
        (priceIsLower ? "price_lowered" : "price_raised")
      }
    >
      <span className="productWatchBtns">
        {isFavorite &&
          <button aria-label="Fjern fra favoritter" className="iconBtn watched" onClick={toggleProdctWatch}><FontAwesomeIcon icon={faHeart} size="lg" /></button>
        }
        {isFavorite === false && user != false &&
          <button aria-label="Legg til i favoritter" className="watch iconBtn dark" onClick={toggleProdctWatch}><FontAwesomeIcon icon={faHeartRegular} size="lg" /></button>
        }
      </span>
      <div className="product_img" style={background}></div>
      {showDiff &&
        <span className="percentage_change">
          {(priceIsLower ? "" : "+") + (product.PriceChange - 100).toFixed(1)}%
        </span>
      }
      <div className="product_details">
        <h2 className="name">{product.Name}</h2>
        <span className="price">Kr {product.LatestPrice}</span>
        <span className="old_price">{product.PriceHistorySorted?.length > 1 && "Kr " + product.PriceHistory[product.PriceHistorySorted[1]]}</span>
        <span className="details">
          {product.Types[product.Types.length - 1]}, {product.Country}
          <br />
          {(product.Volume * 100).toFixed(1)}
          cl, Alk. {product.Alcohol}%
        </span>
        {product.Literprice &&
          <span className="liter_price"> {product.Literprice.toFixed(0)} Kr/l</span>
        }
        {product.Alcohol > 0.7 && product.LiterPriceAlcohol &&
          <span className="liter_price_alchohol"> {product.LiterPriceAlcohol.toFixed(0)} Kr/l alkohol</span>
        }
        {product.Sugar &&
          <span className="sugar">
            <span>Sukker:</span>  {product.Sugar} g/l
          </span>
        }
        {product.Acid &&
          <span className="acid">
            <span>Syre:</span>  {product.Acid} g/l
          </span>
        }

        <div className="description">

          {product.Rating && !Number.isNaN(product.Rating) &&
            <div>
              <span>Vurdering, aperitif.no</span>
              <div className="ratingWrapper" >
                {product.RatingComment &&
                  <div>
                    <i>{'"' + product.RatingComment + '"'}</i>
                    <br />
                    <a rel="noopener noreferrer" target="_blank" href={"https://www.aperitif.no/pollisten?query=" + encodeURIComponent(product.Name.replace(/(\d\d\d\d)/, ""))}>Les mer..</a>
                  </div>
                }
                <div title="Vurdering (aperitif.no)" className="rating">
                  <FontAwesomeIcon icon={faStar} size="lg" />
                  {product.Rating}
                </div>
              </div>
            </div>
          }
          <div className="tasteProfile">
            <ul className="pieCharts">
              {renderTasteProfile(product.Freshness, "Friskhet")}
              {renderTasteProfile(product.Fullness, "Fylde")}
              {renderTasteProfile(product.Sulfates, "Garvestoffer")}
              {renderTasteProfile(product.Sweetness, "Sødme")}
            </ul>
            <ul className="isGoodFor">
              {renderIsGoodFor()}
            </ul>
          </div>
          <ul className="rawMaterials">
            {renderRawMaterials()}
          </ul>
        </div>

      </div>

      <div className="buttons">
        <a
          rel="noopener noreferrer"
          className="clickable bigGoldBtn"
          target="_blank"
          href={"https://www.vinmonopolet.no/p/" + product.Id}
        >
          Se hos vinmonopolet
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
        <button onClick={copyLink} className="clickable bigGreenBtn" aria-label="kopier link">Kopier link <FontAwesomeIcon icon={faLink} /></button>
        <input type="text" style={{ display: "none" }} id="productLink_hidden" />
      </div>
      {renderTextSection(product.Smell, "Lukt")}
      {renderTextSection(product.Taste, "Smak")}
      {renderTextSection(product.Color, "Farge")}
      <div className="priceHistoryWrapper">

        {showGraph ?
          <PriceGraph id={product.Id} priceHistory={product.PriceHistory} />
          :
          <div className="priceGraph fake">
            <h4 className="title">Prishistorikk</h4>
            <img src={emptyGraph} />
          </div>
        }

      </div>
      {product.Stores?.length > 0 &&
        <div className="product_stock">
          <h4 className="title" >På lager i følgende butikker: </h4>
          <ul>{renderStoreStock()}</ul>
        </div>
      }
    </div >
  );
}

export default HighlightedProduct;