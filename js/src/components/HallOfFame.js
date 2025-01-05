import React, { useEffect, useState } from "react";
import "./css/hallOfFame.css";
import {
  faAward,
  faChartLine,
  faGlassCheers,
  faMoneyBillWave,
} from "@fortawesome/free-solid-svg-icons";
import ProductPopUp from "./ProductPopUp";
import Notification from "./Notification";
import roundLogo from "../assets/round-logo.svg";
import SpritjaktClient from "../services/spritjaktClient";
import TypeSenseClient from "../services/typeSenseClient";
import FamedProduct from "./FamedProduct";
import { faThumbsDown, faThumbsUp } from "@fortawesome/free-regular-svg-icons";

const HallOfFame = () => {
  const typeSenseClient = new TypeSenseClient();
  const [hallOfFameProducts, setHallOfFameProducts] = useState(null);
  const [highlightedProduct, setHighlightedProduct] = useState(null);
  const notification = React.createRef();

  useEffect(() => {
    fetchProducts();
  }, [null]);

  const fetchProducts = async () => {
    let hallOfFameProducts = await typeSenseClient.fetchHallOfFameProducts();
    setHallOfFameProducts(hallOfFameProducts);
  };

  const highlightProduct = async (productId) => {
    if (productId === null || productId === highlightedProduct?.Id) {
      setHighlightedProduct(null);
      return;
    }
    let productKey = Object.keys(hallOfFameProducts).find(
      (key) => hallOfFameProducts[key].Id === productId
    );
    if (productKey != undefined) {
      setHighlightedProduct(hallOfFameProducts[productKey]);
    } else {
      var product = await SpritjaktClient.FetchProductById(productId);
      setHighlightedProduct(product);
    }
  };

  return (
    <div className="hall-of-fame">
      <h2 style={{ textAlign: "center" }}>Hall of fame</h2>
      <p style={{ textAlign: "center" }}>
        Her har jeg samlet noen høydepunkter og artig statistikk for spesielt
        interesserte. <br />
        Ikke noe revolusjonerende greier, men litt gøyalt.
      </p>
      {!hallOfFameProducts ? (
        <div className="loader-wrapper">
          <img src={roundLogo} height="50" width="50" className="loader" />
        </div>
      ) : (
        <div>
          <ul className="product-list hall-of-fame">
            <FamedProduct
              product={hallOfFameProducts.cheapestByAlcohol}
              description={
                <p>
                  Bare{" "}
                  <strong>
                    {new Intl.NumberFormat().format(
                      hallOfFameProducts.cheapestByAlcohol.LiterPriceAlcohol
                    )}{" "}
                    kr
                  </strong>{" "}
                  per liter ren alkohol
                </p>
              }
              icon={faGlassCheers}
              positive={true}
              title="Billigste fyll"
              highlightProduct={highlightProduct.bind(this)}
            />
            <FamedProduct
              product={hallOfFameProducts.largestDiscount}
              description={
                <p>
                  Pris redusert med hele{" "}
                  <strong>
                    {(
                      100 - hallOfFameProducts.largestDiscount.PriceChange
                    ).toFixed(1)}
                    %
                  </strong>
                </p>
              }
              icon={faAward}
              title="Største prisfall"
              positive={true}
              highlightProduct={highlightProduct.bind(this)}
            />
            <FamedProduct
              product={hallOfFameProducts.mostVolatile}
              description={
                <p>
                  Gått opp eller ned i pris hele <br />{" "}
                  <strong>
                    {hallOfFameProducts.mostVolatile.PriceChanges - 1} ganger!
                  </strong>
                </p>
              }
              icon={faChartLine}
              positive={true}
              highlightProduct={highlightProduct.bind(this)}
              title="Flest prisendringer"
            />
            <FamedProduct
              product={hallOfFameProducts.highestRated}
              description={
                <p>
                  Best av alle, med{" "}
                  <strong>
                    {hallOfFameProducts.highestRated.VivinoRating} / 6
                  </strong>
                </p>
              }
              icon={faThumbsUp}
              title="Høyest vurdert"
              positive={true}
              highlightProduct={highlightProduct.bind(this)}
            />
          </ul>
          <ul className="product-list hall-of-fame negative">
            <FamedProduct
              product={hallOfFameProducts.mostExpensiveByAlcohol}
              description={
                <p>
                  Hele{" "}
                  <strong>
                    {new Intl.NumberFormat().format(
                      hallOfFameProducts.mostExpensiveByAlcohol
                        .LiterPriceAlcohol
                    )}{" "}
                    kr
                  </strong>{" "}
                  per liter ren alkohol
                </p>
              }
              icon={faGlassCheers}
              title="Dyreste fyll"
              highlightProduct={highlightProduct.bind(this)}
            />
            <FamedProduct
              product={hallOfFameProducts.largestRise}
              description={
                <p>
                  Pris økt med hele{" "}
                  <strong>
                    {(hallOfFameProducts.largestRise.PriceChange - 100).toFixed(
                      1
                    )}
                    %
                  </strong>
                </p>
              }
              icon={faMoneyBillWave}
              title="Største prisøkning"
              highlightProduct={highlightProduct.bind(this)}
            />
            <FamedProduct
              product={hallOfFameProducts.lowestRated}
              description={
                <p>
                  Ganske dårlig altså, med bare{" "}
                  <strong>
                    {hallOfFameProducts.lowestRated.VivinoRating} / 6
                  </strong>
                </p>
              }
              icon={faThumbsDown}
              title="Lavest vurdert"
              highlightProduct={highlightProduct.bind(this)}
            />
          </ul>
        </div>
      )}

      <ProductPopUp
        product={highlightedProduct}
        notification={notification}
        highlightProduct={highlightProduct.bind(this)}
      />
      <Notification ref={notification} />
    </div>
  );
};

export default HallOfFame;
