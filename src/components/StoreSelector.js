import React from "react";
import Select from 'react-select'
import sortArray from "sort-array";

class StoreSelector extends React.Component {
  constructor() {
    super();
    this.ProductFetchTimeout = null;
  }
  handleStoreUpdate = (storeOptions) => {
    let list = [];
    if (storeOptions && storeOptions.length > 0) {
      storeOptions.map(s => list.push(s.value));
    }
    this.props.handleStoreUpdate("stores", list);
  }

  render() {
    const { stores, selectedStores } = this.props;
    let storeOptions = [];
    let selectedOptions = [];
    stores.forEach(s => {
      let count = s.products ? Object.keys(s.products)?.length : 0;
      let option = {
        value: s.storeId,
        label: s.storeName + " (" + count + ")",
        noResults: count === 0
      }
      storeOptions.push(option);
      if (selectedStores.includes(option.value) && !selectedOptions.find(so => so.value === option.value)) {
        selectedOptions.push(option);
      }
    });
    if (selectedStores.includes("online") && !selectedOptions.find(so => so.value === "online")) {
      selectedOptions.push(storeOptions[0]);
    }
    sortArray(storeOptions, {
      by: ["noResults", "label"],
    })

    return (
      <div className="stores" >
        <label>
          <span>Butikk</span>
          <Select
            value={selectedOptions}
            onChange={this.handleStoreUpdate}
            isMulti
            options={storeOptions}
            noOptionsMessage={() => "Fant niks og nada"}
            placeholder={'Filtrer på Butikk'}
            classNamePrefix="select"
            theme={theme => ({
              ...theme,
              colors: {
                ...theme.colors,
                primary: '#d0b55e',
              },
            })}
          />
        </label>
      </div>
    );
  }
}

export default StoreSelector;
