import React from "react";
import "./css/pagination.css";
import PageButton from "./PageButton";
import { sortOptions, theme } from "../utils/utils";
import Sorting from "./Sorting";
import { Box, Pagination } from "@mui/material";
import { ThemeProvider } from "@emotion/react";

const PaginationSection = ({
  pageSize,
  page = 0,
  total = 0,
  setPage,
  useScroll,
  cssAnchor,
  handleSortChange = null
}) => {
const getPaginationText = () => {
  let text = "";
  if (page === 1) {
    text = "1 - " + (pageSize > total ? total : pageSize);
  } else {
    text = 1 + (pageSize * (page - 1)) +
      " - " +
      (pageSize * page > total ? total : pageSize * page);
  }
  return text;
}
  
  const handleClick = (e, value) => {
    if (useScroll) {
      let element = window.document.querySelector("#top-pagination");
      window.scroll({ top: element.getBoundingClientRect().top + document.documentElement.scrollTop, left: 0, behavior: 'smooth' })
    }
    setPage(value);
  }

  return (
    <nav id={cssAnchor} className="Pagination">
      <Pagination color="primary" page={page} onChange={handleClick} count={Math.ceil(total/pageSize)} size="small" />
        <span>
          Viser {getPaginationText()} av {total} produkter
        </span>
      <Box sx={{
        display: "flex",
        flexDirection:"column",
        justifyContent:"space-between"
      }}>
        {  handleSortChange != null && <Sorting handleSortChange={handleSortChange} sortOptions={sortOptions} />}
      </Box>
    </nav>
  );
}

export default PaginationSection;
