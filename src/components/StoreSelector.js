import { faCrosshairs } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Select from 'react-select'
import sortArray from "sort-array";
import React, { useState, useEffect } from "react";
import StoreCacher from "../services/storeCache";

const StoreSelector = ({
  stores,
  selectedStores,
  updateStore,
  notification
}) => {

  const [storeOptions, setStoreOptions] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [userPosition, setUserPosition] = useState(false);

  useEffect(() => {
    let options = [];

    stores.forEach(s => {
      let count = s.count || 0;
      let coords = s?.address?.gpsCoord.split(";") || [999999, 999999];
      let option = {
        value: s.storeId,
        label: s.storeName + " (" + count + ")",
        noResults: count === 0,
        lat: parseFloat(coords[0]),
        long: parseFloat(coords[1])
      }
      options.push(option);
    });
    options = sortStores(options);
    setStoreOptions(options);
  }, [stores]);

  useEffect(() => {
    navigator?.permissions?.query({ name: 'geolocation' }).then(res => {
      if (res.state == "granted") {
        getUserPosition();
      }
    }
    );
  }, []);

  useEffect(() => {
    let newSelected = storeOptions.filter(so => selectedStores.includes(so.value));
    setSelectedOptions(newSelected);
    if (storeOptions.length > 0)
      StoreCacher.set(storeOptions);
  }, [selectedStores, storeOptions]);

  const sortStores = (storeOptions, position = userPosition) => {
    sortArray(storeOptions, {
      by: ["geo", "noResults", "label"],
      computed: {
        geo: s => {
          if (position && s.value !== "online") {
            return Math.abs(s.lat - position.coords.latitude) + Math.abs(s.long - position.coords.longitude)
          }
          return s.value === "online" ? 0 : 1
        }
      }
    });
    return storeOptions;
  }

  const handleStoreUpdate = (storeOptions) => {
    let list = [];
    if (storeOptions && storeOptions.length > 0) {
      storeOptions.map(s => list.push(s.value));
    }
    updateStore("stores", list);
  }

  useEffect(() => {
    if (userPosition == false) return;
    let newOrder = sortStores(storeOptions);
    setStoreOptions(newOrder);
  }, [userPosition]);

  const getUserPosition = (e = null) => {
    var event = e == null ? null : Object.assign({}, e);
    navigator.geolocation.getCurrentPosition(async (position) => {
      setUserPosition(position);
      if (event !== null) {
        let sortedStores = sortStores(storeOptions, position);
        handleStoreUpdate([sortedStores[1]])
      }
    }, function (error) {
      if (event !== null) {
        notification.current.setNotification(event, "Tillat posisjonsdata", "error");
      }
    }
    );
  }

  return (
    <div className="stores" >
      <label>
        <span>Butikk</span>
        <Select
          value={selectedOptions}
          onChange={handleStoreUpdate}
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
      {"geolocation" in navigator && selectedStores?.length === 0 &&
        <button title="Finn nærmeste butikk" className="filterAddonBtn iconBtn dark" onClick={getUserPosition}>
          <FontAwesomeIcon icon={faCrosshairs} />
        </button>
      }
    </div >
  );

}

export default StoreSelector;