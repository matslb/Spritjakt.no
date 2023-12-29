import React, { useEffect, useState } from "react";
import "./css/productComp.css";
import {
  faGlobeEurope,
  faHeart,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import dateFormater from "../dateFormater";
import { getImageUrl } from "../utils/utils.js";
import SpritjaktClient from "../services/spritjaktClient";

const Product = ({
  product,
  highlightProduct,
  notification,
  userId,
  userFavorites,
  toggleLoginSection,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoggedIn, setisLoggedIn] = useState(false);

  useEffect(() => {
    if (userId) {
      setisLoggedIn(true);
      let IsSelectedByUser =
        userFavorites !== undefined
          ? userFavorites.includes(product.Id)
          : false;
      setIsFavorite(IsSelectedByUser);
    } else {
      setIsFavorite(false);
      setisLoggedIn(false);
    }
  }, [userId, userFavorites, product]);

  const toggleProdctWatch = (e) => {
    if (!isLoggedIn) {
      toggleLoginSection();
      return;
    }
    if (isFavorite) {
      SpritjaktClient.RemoveProductFromUser(product.Id);
      notification.current.setNotification(e, "Fjernet", "success");
    } else {
      SpritjaktClient.AddProductToUser(product.Id);
      notification.current.setNotification(e, "Lagt til", "success");
    }
    setIsFavorite(!isFavorite);
  };

  let showDiff =
    (product.PriceChange && product.PriceChange > 100.1) ||
    product.PriceChange < 99.9;

  let lastChangedDate = dateFormater.format(
    dateFormater.parse(product.LastUpdated)
  );
  let isSoldOut = product.Stores.length == 0;

  return (
    <div
      id={"p-" + product.Id}
      className={
        "ProductComp " +
        (product.PriceChange < 100 ? "price_lowered" : "price_raised")
      }
    >
      <button
        aria-label={product.Name + ". Velg for å se produktdetaljer"}
        style={{
          padding: 0,
          opacity: 0,
        }}
        onClick={() => highlightProduct(product.Id)}
      >
        {product.Name}
      </button>
      <div
        onClick={() => highlightProduct(product.Id)}
        className={"product_img " + (isSoldOut ? " soldOut" : "")}
      >
        <img
          alt={product.Name}
          height="200px"
          width="100px"
          src={getImageUrl(product.Id, 300)}
        />
      </div>
      {showDiff && product.LatestPrice && (
        <span className="percentage_change">
          {(product.PriceChange < 100 ? "" : "+") +
            (product.PriceChange - 100).toFixed(1)}
          %
        </span>
      )}
      <span className="productWatchBtns">
        <span className="changeDate">{lastChangedDate}</span>
        {isFavorite && toggleLoginSection && (
          <button
            aria-label="Fjern fra favoritter"
            title="Fjern fra favoritter"
            className="iconBtn watched"
            onClick={toggleProdctWatch}
          >
            <FontAwesomeIcon icon={faHeart} size="lg" />
          </button>
        )}
        {!isFavorite && toggleLoginSection && (
          <button
            aria-label="Legg til i favoritter"
            title="Legg til i favoritter"
            className="watch dark iconBtn"
            onClick={toggleProdctWatch}
          >
            <FontAwesomeIcon icon={faHeartRegular} size="lg" />
          </button>
        )}
      </span>
      <div
        onClick={() => highlightProduct(product.Id)}
        className="product_details"
      >
        {product.Buyable == false && (
          <span className={"soldOutSticker"}>
            {product.Expired ? "Utgått" : "Utsolgt"}
          </span>
        )}
        <div className="detailsLine">
          <span className="type">
            {product.Type ?? product.Types[product.Types.length - 1]}
          </span>
          {product.Rating && !Number.isNaN(product.Rating) && (
            <span title="Vurdering (aperitif.no)" className="rating">
              <FontAwesomeIcon icon={faStar} size="lg" />
              {product.Rating}
            </span>
          )}
          <span className={"stock"} title="Lagerstatus">
            {product.Country}
            <FontAwesomeIcon icon={faGlobeEurope} />
          </span>
        </div>
        <h2 className="name">{product.Name}</h2>
        {product.LatestPrice && (
          <span className="price">Kr {product.LatestPrice}</span>
        )}
        {product.PriceHistorySorted &&
          product["PriceHistory." + [product.PriceHistorySorted[1]]] && (
            <span className="old_price secondary">
              Kr {product["PriceHistory." + [product.PriceHistorySorted[1]]]}
            </span>
          )}
        <span className="volume secondary">{product.Volume.toFixed(1)} cl</span>
        <span className="alcohol secondary">Alk. {product.Alcohol}%</span>
      </div>
    </div>
  );
};

export default Product;
