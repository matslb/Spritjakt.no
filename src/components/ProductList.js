import React from "react";
import Product from "./Product";

const ProductList = ({
  products,
  pageSize,
  page,
  highlightProduct,
  notification,
  user,
  toggleLoginSection
}) => {

  const renderProducts = () => {
    let renderedProducts = [];
    let startPoint = products.length > pageSize ? pageSize * (page - 1) : 0;
    for (let i = startPoint; i < products.length; i++) {
      const p = products[i];
      if (renderedProducts.length < pageSize) {
        renderedProducts.push(<li
          key={p.Id} >
          <Product
            product={p}
            userId={user?.Id}
            userFavorites={user?.products}
            notification={notification}
            highlightProduct={highlightProduct}
            toggleLoginSection={toggleLoginSection}
          />
        </li>
        );
      }
    }
    return renderedProducts;
  }
  return renderProducts();
}

export default ProductList;
