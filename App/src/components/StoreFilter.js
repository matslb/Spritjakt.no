import { faCrosshairs } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Select from "react-select";
import sortArray from "sort-array";
import React, { useState, useEffect } from "react";
import StoreCacher from "../services/storeCache";
import FilterV2 from "./FilterV2";

const StoreFilter = ({ stores, selectedStores, updateStore, notification }) => {
  const [userPosition, setUserPosition] = useState(false);

  useEffect(() => {
    navigator?.permissions?.query({ name: "geolocation" }).then((res) => {
      if (res.state == "granted") {
        getUserPosition();
      }
    });
  }, []);

  const sortStores = (storeOptions, position = userPosition) => {
    sortArray(storeOptions, {
      by: ["geo", "noResults", "label"],
      computed: {
        geo: (s) => {
          if (position && s.value !== "online") {
            return (
              Math.abs(s.lat - position.coords.latitude) +
              Math.abs(s.long - position.coords.longitude)
            );
          }
          return s.value === "online" ? 0 : 1;
        },
      },
    });
    return storeOptions;
  };

  const getUserPosition = (e = null) => {
    var event = e == null ? null : Object.assign({}, e);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setUserPosition(position);
        if (event !== null) {
          let sortedStores = sortStores(stores, position);
          updateStore("stores", [sortedStores[0].value]);
        }
      },
      function (error) {
        if (event !== null) {
          notification.current.setNotification(
            event,
            "Tillat posisjonsdata",
            "error"
          );
        }
      }
    );
  };

  return (
    <div className="stores">
      <FilterV2
        items={stores}
        selectedItems={selectedStores}
        propSlug={"stores"}
        label={"Butikk"}
        handleFilterChange={updateStore}
      />
      {"geolocation" in navigator && selectedStores?.length === 0 && (
        <button
          title="Finn nærmeste butikk"
          className="filterAddonBtn iconBtn dark"
          onClick={getUserPosition}
        >
          <FontAwesomeIcon icon={faCrosshairs} />
        </button>
      )}
    </div>
  );
};

export default StoreFilter;
