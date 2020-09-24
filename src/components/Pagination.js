import React from "react";
import "./css/pagination.css";
import PageButton from "./PageButton";

class Pagination extends React.Component {
  setPage = (page) => {
    this.props.setPage(page);
  };

  renderPageButtons = () => {
    let list = [];
    let pages = Math.ceil(this.props.total / this.props.pageSize);
    for (let i = 1; i <= pages; i++) {
      if (pages < 8 || (i < 3 || i > (pages - 2) || this.props.page === i || this.props.page === i + 1 || this.props.page === i - 1)) {
        list.push(
          <PageButton
            key={"page-" + i}
            page={i}
            isSelected={this.props.page === i}
            setPage={this.setPage.bind(this)}
          />
        );
      } else if (
        (pages >= 8 && i === 3 && this.props.page < 3)
        || (this.props.page === i + 2)
        || (this.props.page === i - 2)
        || (this.props.page === pages && i === this.props.page - 2)) {
        list.push(
          <li>
            <button style={{ pointerEvents: "none" }} className="pageButton clickable inactive">
              ...
            </button>
          </li>
        );
      }
    }
    return list;
  };
  render() {
    let { pageSize, page, total } = this.props;
    let productsShowingtext;

    if (page !== 1 && page > Math.ceil(total / pageSize)) {
      this.setPage(1);
    } else if (page === 1) {
      productsShowingtext = "1 - " + (pageSize > total ? total : pageSize);
    } else {
      productsShowingtext = 1 + (pageSize * (page - 1)) +
        " - " +
        (pageSize * page > total ? total : pageSize * page);
    }
    return (
      <nav className="Pagination">
        <ul className="pagelist">{this.renderPageButtons()}</ul>
        <span>
          Viser {productsShowingtext} av {total} produkter
        </span>
      </nav>
    );
  }
}

export default Pagination;
