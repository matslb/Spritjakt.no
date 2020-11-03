import React from "react";
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
      storeOptions.map(s => list.push(s.value));
    } else {
      list.push("0");
    }
    this.setState({
      selectedOptions: storeOptions
    });

    this.props.handleStoreUpdate(list);
  }

  render() {
    const {stores, selectedStores} = this.props;
    let storeOptions = [{ label: "vinmonopolet.no", value: "online" }];
    let selectedOptions = this.state.selectedOptions ?? [];
    stores.forEach(s => {
      let option = {
        value: s.storeId,
        label: s.storeName + " (" + (s.count ? s.count : 0 ) + ")",
        disabled: s.count == undefined
      }
      storeOptions.push(option);
      if (selectedStores.includes(option.value) && !selectedOptions.find(so => so.value == option.value)) {
        selectedOptions.push(option);
      }
    });
    if (selectedStores.includes("online") && !selectedOptions.find(so => so.value == "online")) {
      selectedOptions.push(storeOptions[0]);
    }

    return (
      <div className="stores" >
        <label>
          <span>Butikker</span>
          <Select
            value={selectedOptions}
            onChange={this.handleStoreUpdate}
            isMulti
            options={storeOptions}
            isOptionDisabled={o => o.disabled === true}
            noOptionsMessage={() => "Fant niks og nada"}
            placeholder={'Velg butikker'}
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
