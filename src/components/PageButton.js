import React from "react";

const PageButton = ({
  setPage,
  page,
  isSelected,
  useScroll
}) => {

  const handleClick = () => {
    if (useScroll) {
      let element = window.document.querySelector("#top-pagination");
      window.scroll({ top: element.getBoundingClientRect().top + document.documentElement.scrollTop, left: 0, behavior: 'smooth' })
    }
    setPage(page);
  }
  return (
    <li>
      <button
        className={
          "pageButton clickable " +
          (isSelected ? "active" : "inactive")
        }
        onClick={() => handleClick()}
      >
        {page}
      </button>
    </li>
  );
}

export default PageButton;
