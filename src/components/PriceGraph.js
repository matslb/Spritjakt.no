import React from "react";
import { ResponsiveLine } from "@nivo/line";
import "./css/priceGraph.css";
import SortArray from "sort-array";
import HighlightedProduct from "./HighlightedProduct";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import dateFormater from "../dateFormater";

class PriceGraph extends React.Component {
  componentDidMount() {
    this.vmpLink.focus();
  }

  render() {
    var { p } = this.props;

    let config = {
      id: p.Name,
      color: "#49908d",
      data: [],
    };
    let today = new Date();
    today.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());

    var pricesReversed = p.PriceHistorySorted.slice();
    pricesReversed.reverse();

    for (let i = 0; i < pricesReversed.length; i++) {
      let datestring = dateFormater.format(pricesReversed[i]);

      let mostRecentPrice = p.PriceHistory[pricesReversed[i]];
      if (config.data[config.data.length - 1] === undefined || (config.data[config.data.length - 1].x !== datestring && p.PriceHistory[pricesReversed[i - 1]] !== mostRecentPrice)) {
        config.data.push({ x: datestring, y: mostRecentPrice });
      }
    }

    let priceSortedByAmount = SortArray(Object.values(p.PriceHistory), {
      order: "desc",
    });
    let minPrice = priceSortedByAmount[priceSortedByAmount.length - 1] * 0.8;
    let maxPrice = priceSortedByAmount[0] * 1.2;
    return (
      <div className="expandedProduct">
        <HighlightedProduct product={p} isGraph={false} />
        <a
          rel="noopener noreferrer"
          ref={(link) => {
            this.vmpLink = link;
          }}
          className="clickable"
          target="_blank"
          href={"https://www.vinmonopolet.no/p/" + p.Id}
        >
          Se hos vinmonopolet
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
        <h3 className="title">Prishistorikk</h3>
        <div className="graph">
          <ResponsiveLine
            data={[config]}
            margin={{
              top: 20,
              right: 20,
              bottom: 40,
              left: 40,
            }}
            yScale={{
              type: "linear",
              min: minPrice,
              max: maxPrice,
              stacked: false,
              reverse: false,
            }}
            curve="step"
            axisTop={null}
            axisRight={null}
            axisLeft={{
              tickValues: 5,
            }}
            xScale={{
              type: "time",
              format: "%d-%m-%Y",
              precision: "day",
            }}
            xFormat="time:%d-%m-%Y"
            axisBottom={{
              orient: "right",
              format: "%d %b",
              legendOffset: 0,
              tickRotation: 50,
              tickSize: 5,
              tickPadding: 2,
              legendPosition: "middle",
            }}
            areaBaselineValue={minPrice}
            enableGridX={false}
            colors={{
              datum: "color",
            }}
            lineWidth={3}
            enableArea={true}
            enablePoints={true}
            pointSize={5}
            pointColor="#d0b55e"
            pointBorderColor={{ from: 'serieColor' }}
            pointBorderWidth={2}
            areaOpacity={0.5}
            crosshairType="x"
            useMesh={true}
            legends={[]}
            enableSlices="x"
            sliceTooltip={({ slice }) => {
              return (
                <div
                  style={{
                    background: "#49908d",
                    padding: "9px 12px",
                    borderRadius: "3px",
                    color: "white",
                    boxShadow: "1px 1px 5px rgba(0,0,0,.3)",
                  }}
                >
                  {slice.points.map((point) => (
                    <div
                      key={point.id}
                      style={{
                        padding: "3px 0",
                      }}
                    >
                      <span>{point.data.xFormatted}</span>
                      <br />
                      <strong>{point.data.yFormatted},-</strong>
                    </div>
                  ))}
                </div>
              );
            }}
          />
        </div>
      </div>
    );
  }
}

export default PriceGraph;
