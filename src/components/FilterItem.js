import React from "react";
import "./css/filterItem.css";

class FilterItem extends React.Component {
  render() {
    var { handleFilterClick, item, name } = this.props;
    return (
      <label className={"clickable filter-item " + item.state}>
        <input
          type="checkbox"
          name={name}
          onClick={() => handleFilterClick(!item.state, name)}
          defaultChecked={item.state}
        />
        <span className="name">{name}</span>
        <span className="count">{Object.keys(item.products).length}</span>
      </label>
    );
  }
}

export default FilterItem;
