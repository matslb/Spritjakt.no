import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Product from "./Product";

const FamedProduct = ({
  icon,
  product,
  highlightProduct,
  title,
  positive,
  description,
}) => {
  return (
    <li className={"famed-product " + (positive ? "positive" : "negative")}>
      <FontAwesomeIcon
        className={positive ? "gold" : "dark"}
        icon={icon}
        size="3x"
      />
      <h3 className={positive ? "gold" : "dark"}>{title}</h3>
      <div>
        {description}
        <Product
          product={product}
          highlightProduct={highlightProduct.bind(this)}
        />
      </div>
    </li>
  );
};

export default FamedProduct;
