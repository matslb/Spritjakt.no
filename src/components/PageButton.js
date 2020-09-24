import React from "react";

class PageButton extends React.Component {
  render() {
    return (
      <li>
        <button
          className={
            "pageButton clickable " +
            (this.props.isSelected ? "active" : "inactive")
          }
          ref={this.productButton}
          onClick={() => this.props.setPage(this.props.page)}
        >
          {this.props.page}
        </button>
      </li>
    );
  }
}

export default PageButton;
