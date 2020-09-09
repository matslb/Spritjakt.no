import React from "react";
import "./css/storeSelector.css";
import SortArray from "sort-array";
import Select from 'react-select'

class StoreSelector extends React.Component {
  constructor() {
    super();
    this.state = {
      selectedOptions: []
    };
    this.ProductFetchTimeout = null;
  }
  handleStoreUpdate = (storeOptions) => {
    let list = [];
    if (storeOptions && storeOptions.length > 0) {
      storeOptions.map(s => {
        list.push(s.value);
      });
    } else {
      list.push("0");
    }
    this.setState({
      selectedOptions: storeOptions
    });

    this.props.handleStoreUpdate(list);
  }

  render() {

    let stores = this.props.stores;
    let storeOptions = [];
    let selectedOptions = this.state.selectedOptions ?? [];

    stores.map(s => {
      let count = 0
      if (s.count) {
        count = this.props.discountFilter === "all" ? s.count.raised + s.count.lowered : s.count[this.props.discountFilter] || 0;
      }
      let option = {
        value: s.storeId,
        label: s.storeName + " (" + count + ")",
        disabled: count === 0
      }
      storeOptions.push(option);
      let selectedOption = selectedOptions.find(so => so.value === option.value);
      if (selectedOption) {
        selectedOptions[selectedOptions.indexOf(selectedOption)].label = option.label;
      }
    });


    return (
      <div className="stores" >
        <label>
          <span style={{ display: "block", height: 0, width: 0, overflow: "hidden" }}>Velg butikker</span>
          <Select
            value={this.state.selectedOptions}
            onChange={this.handleStoreUpdate}
            isMulti
            options={storeOptions}
            isOptionDisabled={o => o.disabled === true}
            noOptionsMessage={() => "Fant niks og nada"}
            placeholder={'Velg butikker'}
            theme={theme => ({
              ...theme,
              colors: {
                ...theme.colors,
                primary: 'black',
              },
            })}
          />
        </label>
      </div>
    );
  }
}

export default StoreSelector;
