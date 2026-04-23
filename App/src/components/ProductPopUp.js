import {
  faArrowCircleLeft,
  faArrowCircleRight,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect } from "react";
import HighlightedProduct from "./HighlightedProduct";
import { formatPriceHistory } from "../utils/utils.js";
import "./css/popupProduct.css";

const ProductPopUp = ({
  notification,
  product,
  nextProduct,
  highlightProduct,
}) => {
  useEffect(() => {
    document.addEventListener("keydown", keyNavigationHandler);

    return () => {
      document.removeEventListener("keydown", keyNavigationHandler);
    };
  }, [product]);

  const keyNavigationHandler = (event) => {
    if (product == false) return;

    switch (event.code) {
      case "ArrowRight":
        if (nextProduct) nextProduct(1);
        break;
      case "ArrowLeft":
        if (nextProduct) nextProduct(-1);
        break;
      case "Escape":
        highlightProduct(null);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className="PopupProduct"
      style={{ position: "absolute", zIndex: "99" }}
    >
      {product && (
        <div>
          <div
            className="backdrop"
            onClick={() => highlightProduct(null)}
          ></div>
          <div className="PopupProductWrapper">
            <HighlightedProduct
              highlightProduct={highlightProduct}
              product={formatPriceHistory(product)}
              notification={notification}
            />
            <nav
              aria-label="Naviger fremhevet produkt"
              className="productNavigation"
            >
              {nextProduct && (
                <button
                  aria-label="Forrige produkt"
                  onClick={() => nextProduct(-1)}
                  className="iconBtn productNav prev"
                >
                  <FontAwesomeIcon size="lg" icon={faArrowCircleLeft} />
                </button>
              )}
              <button
                aria-label="Lukk fremhevet produktvisning"
                name="closeGraph"
                onClick={() => highlightProduct(null)}
                className="iconBtn productNav close"
              >
                <FontAwesomeIcon size="lg" icon={faTimesCircle} />
              </button>
              {nextProduct && (
                <button
                  aria-label="Neste produkt"
                  onClick={() => nextProduct(1)}
                  className="iconBtn productNav next"
                >
                  <FontAwesomeIcon size="lg" icon={faArrowCircleRight} />
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPopUp;
