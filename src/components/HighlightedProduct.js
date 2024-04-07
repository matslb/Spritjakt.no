import React, { useState, useEffect, useCallback, useRef } from "react";
import "./css/highlightedProduct.css";
import {
  faExternalLinkAlt,
  faHeart,
  faLink,
  faSeedling,
  faStar,
  faWineBottle,
} from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SpritjaktClient from "../services/spritjaktClient";
import firebase from "firebase/compat/app";
import { getImageUrl } from "../utils/utils.js";
import PriceGraph from "./PriceGraph";
import copy from "copy-to-clipboard";
import StoreCacher from "../services/storeCache";
import debounce from "lodash.debounce";
import emptyGraph from "../assets/emptyGraph.png";
import { isMobile } from "react-device-detect";
import TypeSenseClient from "../services/typeSenseClient";
import sortArray from "sort-array";
import vivinoLogo from "../assets/vivino.svg";
import aperitifLogo from "../assets/aperitif.ico";

const HighlightedProduct = ({ product, notification, highlightProduct }) => {
  const [user, setUser] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showGraph, setShowGraph] = useState(!isMobile);
  const [stockFetchDate, setStockFetchDate] = useState(false);
  const background = {
    backgroundImage: "url(" + getImageUrl(product.Id, 300) + ")",
  };
  const showDiff = product.PriceChange > 100.1 || product.PriceChange < 99.9;
  const stores = StoreCacher.get();
  const [vintages, setVintages] = useState([]);
  const rootRef = useRef(null);
  const [ratingUrl, setRatingUrl] = useState();

  useEffect(() => {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
      } else {
        setIsFavorite(false);
      }
    });
  }, []);

  useEffect(() => {
    fetchVintages();
    if (product.LastPriceFetchDate) {
      var diff = Math.floor(
        (new Date().getTime() -
          new Date(
            (product.LastPriceFetchDate.seconds ?? product.LastPriceFetchDate) *
              1000
          ).getTime()) /
          1000 /
          60 /
          60 /
          24
      );
      if (diff < 1000) {
        setStockFetchDate(
          diff == 0
            ? "mindre enn et døgn siden"
            : diff + " dag" + (diff > 1 ? "er" : "") + " siden."
        );
      } else {
        setStockFetchDate(
          " helt tullete mange dager siden, om i det hele tatt."
        );
      }
    }
    setRatingUrl(
      product?.RatingUrl ||
        "https://www.aperitif.no/pollisten?query=" +
          encodeURIComponent(product.Name.replace(/(\d\d\d\d)/, ""))
    );

    rootRef?.current?.focus();

    if (!isMobile) return;
    if (showGraph) {
      setShowGraph(false);
    }
    debouncedChangeHandler();
  }, [product]);

  const fetchVintages = async () => {
    const typesenseClient = new TypeSenseClient();
    const productVintages = await typesenseClient.fetchProductVintages(
      product.Id.split("x")[0]
    );
    setVintages(
      sortArray(
        productVintages.hits
          ?.filter(
            (p) =>
              p.document.Id.split("x")[0] == product.Id.split("x")[0] &&
              p.document.Year != undefined
          )
          .map((p) => {
            return { year: p.document.Year, id: p.document.Id };
          }),
        {
          by: "year",
        }
      )
    );
  };

  const debouncedChangeHandler = useCallback(
    debounce(() => setShowGraph(true), 200),
    [product, 200]
  );

  useEffect(() => {
    if (!user) return;

    firebase
      .firestore()
      .collection("Users")
      .doc(user.uid)
      .onSnapshot(async (doc) => {
        let userData = doc.data();
        if (userData) {
          let isFavorite =
            userData.products !== undefined
              ? userData.products.includes(product.Id)
              : false;
          setIsFavorite(isFavorite);
        }
      });
  }, [user, product]);

  const toggleProdctWatch = (e) => {
    if (isFavorite) {
      SpritjaktClient.RemoveProductFromUser(product.Id);
      notification.current.setNotification(e, "Fjernet", "success");
    } else {
      SpritjaktClient.AddProductToUser(product.Id);
      notification.current.setNotification(e, "Lagt til", "success");
    }
    setIsFavorite(!isFavorite);
  };
  const copyLink = (event) => {
    let link = window.location.href.includes("product")
      ? window.location.href
      : window.location.origin + "?product=" + product.Id;
    copy(link);
    notification.current.setNotification(
      event,
      "Kopiert til utklippstavlen",
      "success"
    );
    firebase.analytics().logEvent("user_link_copied");
  };

  const createPieChartCss = (value) => {
    return {
      background:
        "conic-gradient(#2e2e2e 0.00%" + (value * 100) / 12 + "%, white 0%)",
    };
  };

  const renderStoreStock = () => {
    let list = [];
    if (product.Stores.includes("online"))
      list.push(
        <li key="online">
          <span>Nettlager</span>
          <span>{product.ProductStatusSalename}</span>
        </li>
      );
    for (const store of stores) {
      let storeStock = product.Stores.find((s) => s == store.value);
      if (storeStock && storeStock != "online")
        list.push(
          <li key={store.value}>
            <span>{store.label.split(" (")[0]}</span>
          </li>
        );
    }

    return list;
  };

  const renderIsGoodFor = () => {
    let foods = [];
    if (product.IsGoodFor)
      for (const food of product.IsGoodFor) {
        foods.push(
          <li className="food" key={food.code}>
            <div>
              <img src={"/images/icons/" + food.code + ".png"} />
            </div>
            {food.name}
          </li>
        );
      }
    return foods;
  };
  const renderRawMaterials = () => {
    let materials = [];
    if (product.RawMaterials)
      for (const material of product.RawMaterials) {
        materials.push(
          <li className="material" key={material.code}>
            {materials.length === 0 && (
              <FontAwesomeIcon icon={faSeedling} size="lg" />
            )}
            {material.name}
            {material.percentage && ", " + material.percentage + "%"}
          </li>
        );
      }
    return materials;
  };
  const renderTasteProfile = (value, label) => {
    return value ? (
      <li key={label} className="pieChartWrapper">
        <div
          aria-label={value}
          className="pieChart"
          style={createPieChartCss(value)}
        ></div>
        {label}
      </li>
    ) : null;
  };

  const renderTextSection = (text, label) => {
    return text ? (
      <section className="descriptionText">
        <h3>{label}</h3>
        <p>{text}</p>
      </section>
    ) : null;
  };

  const renderVintages = () => {
    return (
      <section className="vintages descriptionText">
        <h3>Årganger</h3>
        <div className="vintageButtons">
          {vintages.map((v) => (
            <button
              key={v.year}
              onClick={() =>
                product.Year == v.year ? null : highlightProduct(v.id)
              }
              className={
                "clickable" + (v.year == product.Year ? " bigGoldBtn" : "")
              }
            >
              {v.year}
            </button>
          ))}
        </div>
      </section>
    );
  };

  return (
    <article
      id={product.Id}
      className={
        "HighlightedProduct " +
        (product.PriceChange < 100 ? "price_lowered" : "price_raised")
      }
    >
      <span className="productWatchBtns">
        {isFavorite && (
          <button
            aria-label="Fjern fra favoritter"
            className="iconBtn watched"
            onClick={toggleProdctWatch}
          >
            <FontAwesomeIcon icon={faHeart} size="lg" />
          </button>
        )}
        {isFavorite === false && user != false && (
          <button
            aria-label="Legg til i favoritter"
            className="watch iconBtn dark"
            onClick={toggleProdctWatch}
          >
            <FontAwesomeIcon icon={faHeartRegular} size="lg" />
          </button>
        )}
      </span>
      <div className="product_img" style={background}></div>
      {showDiff && (
        <span className="percentage_change">
          {(product.PriceChange < 100 ? "" : "+") +
            (product.PriceChange - 100).toFixed(1)}
          %
        </span>
      )}
      <section className="product_details">
        <h2 className="name">{product.Name}</h2>
        {product.LatestPrice && !product.Expired ? (
          <span className="price">Kr {product.LatestPrice}</span>
        ) : (
          <span className="price">Utgått</span>
        )}
        {product.PriceHistorySorted && (
          <span className="old_price">
            {product.PriceHistorySorted?.length > 1 &&
              "Kr " +
                product["PriceHistory." + [product.PriceHistorySorted[1]]]}
          </span>
        )}
        <span className="details">
          {product.Type ?? product.Types[product.Types.length - 1]},{" "}
          {product.Country}
          <br />
          {product.Volume.toFixed(1)}
          cl, Alk. {product.Alcohol}%
        </span>
        {product.Literprice && (
          <span className="liter_price">
            {" "}
            {product.Literprice.toFixed(0)} Kr/l
          </span>
        )}
        {product.Alcohol > 0.7 && product.LiterPriceAlcohol && (
          <span className="liter_price_alchohol">
            {" "}
            {product.LiterPriceAlcohol.toFixed(0)} Kr/l alkohol
          </span>
        )}
        {product.Sugar && (
          <span className="sugar">
            <span>Sukker:</span> {product.Sugar} g/l
          </span>
        )}
        {product.Acid && (
          <span className="acid">
            <span>Syre:</span> {product.Acid} g/l
          </span>
        )}

        <div className="description">
          <div className="tasteProfile">
            <ul className="pieCharts">
              {renderTasteProfile(product.Freshness, "Friskhet")}
              {renderTasteProfile(product.Fullness, "Fylde")}
              {renderTasteProfile(product.Sulfates, "Garvestoffer")}
              {renderTasteProfile(product.Sweetness, "Sødme")}
            </ul>
            <ul className="isGoodFor">{renderIsGoodFor()}</ul>
          </div>
          {product.VintageComment && (
            <div className="vintageComment">
              <FontAwesomeIcon icon={faWineBottle} size="lg" />
              {product.VintageComment}
            </div>
          )}
          <ul className="rawMaterials">{renderRawMaterials()}</ul>
        </div>
      </section>

      <section className="buttons">
        {!product.Id.includes("x") ? (
          <a
            rel="noopener noreferrer"
            className="clickable bigGoldBtn"
            target="_blank"
            href={"https://www.vinmonopolet.no/p/" + product.Id}
            ref={rootRef}
          >
            Se hos vinmonopolet
            <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>
        ) : (
          <button className="clickable dark" disabled={true}>
            Ikke lenger tilgjengelig hos vinmonopolet
            <FontAwesomeIcon icon={faExternalLinkAlt} />
          </button>
        )}
        <button
          onClick={copyLink}
          className="clickable bigGreenBtn"
          aria-label="kopier link"
        >
          Kopier link <FontAwesomeIcon icon={faLink} />
        </button>
        <input
          type="text"
          style={{ display: "none" }}
          id="productLink_hidden"
        />
      </section>

      {/*product.Rating &&
        renderTextSection(
          <p>
            <i>{'"' + product.RatingComment + '"'}</i>
            <br />
            <a rel="noopener noreferrer" target="_blank" href={ratingUrl}>
              Les mer på aperitif.no
            </a>
          </p>,
          <div title="Vurdering aperitif.no" className="rating">
            <img width="14px" height="17px" src={aperitifLogo} />
            Apéritif -<strong>{product.Rating}</strong>
          </div>
        ) */}

      {product.VivinoRating &&
        renderTextSection(
          <a rel="noopener noreferrer" target="_blank" href={product.VivinoUrl}>
            Les mer på vivino.com
          </a>,
          <div title="Vurdering vivino.com" className="rating ">
            <img width="14px" src={vivinoLogo} /> Vivino -
            <strong>{product.VivinoRating}</strong>
          </div>
        )}

      {vintages.length > 1 && renderVintages()}
      {renderTextSection(product.Types.join(", "), "Kategorier")}
      {renderTextSection(product.Smell, "Lukt")}
      {renderTextSection(product.Taste, "Smak")}
      {renderTextSection(product.Color, "Farge")}

      <div className="priceHistoryWrapper">
        {showGraph && product.PriceHistorySorted && (
          <PriceGraph product={product} />
        )}
        {!showGraph && product.PriceHistory != undefined && (
          <div className="priceGraph fake descriptionText">
            <h3 className="title">Prishistorikk</h3>
            <img src={emptyGraph} />
          </div>
        )}
      </div>
      {product.Stores?.length > 0 && (
        <div className="product_stock descriptionText">
          <h3 className="title">Lagerstatus </h3>
          <ul>{renderStoreStock()}</ul>
        </div>
      )}
      {stockFetchDate && (
        <div className="descriptionText">
          <i>Lagerstatus oppdatert for {stockFetchDate}</i>
        </div>
      )}
    </article>
  );
};

export default HighlightedProduct;
