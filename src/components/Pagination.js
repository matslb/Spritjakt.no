import React from "react";
import "./css/pagination.css";
import PageButton from "./PageButton";

const Pagination = ({
  pageSize,
  page,
  total,
  setPage,
  useScroll,
  cssAnchor
}) => {

  const renderPageButtons = () => {
    let list = [];
    let pages = Math.ceil(total / pageSize);
    for (let i = 1; i <= pages; i++) {
      if (pages < 8 || (i < 3 || i > (pages - 2) || page === i || page === i + 1 || page === i - 1)) {
        list.push(
          <PageButton
            key={"page-" + i}
            page={i}
            isSelected={page === i}
            setPage={setPage.bind(this)}
            useScroll={useScroll}
          />
        );
      } else if (
        (pages >= 8 && i === 3 && page < 3)
        || (page === i + 2)
        || (page === i - 2)
        || (page === pages && i === page - 2)) {
        list.push(
          <li key={"page" + i}>
            <div style={{ pointerEvents: "none" }} className="pageButton clickable inactive dummy">
              ...
            </div>
          </li>
        );
      }
    }
    return list;
  };

  let productsShowingtext;

  if (page === 1) {
    productsShowingtext = "1 - " + (pageSize > total ? total : pageSize);
  } else {
    productsShowingtext = 1 + (pageSize * (page - 1)) +
      " - " +
      (pageSize * page > total ? total : pageSize * page);
  }
  return (
    <nav id={cssAnchor} className="Pagination">
      <ul className="pagelist">{renderPageButtons()}</ul>
      <span>
        Viser {productsShowingtext} av {total} produkter
      </span>
    </nav>
  );
}

export default Pagination;
