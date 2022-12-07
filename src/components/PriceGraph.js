import React, { useEffect, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import "./css/priceGraph.css";
import dateFormater from "../dateFormater";

const PriceGraph = ({
  product
}) => {

  const [graphOptions, setGraphOptions] = useState();

  useEffect(() => {
    let config = {
      id: product.Id,
      color: "#1c323a",
      data: [],
      minPrice: 99999,
      maxPrice: 0
    };

    for (const date of product.PriceHistorySorted) {
      let price = product["PriceHistory." + date];
      config.minPrice = price < config.minPrice ? price : config.minPrice;
      config.maxPrice = price > config.maxPrice ? price : config.maxPrice;
      config.data.push({ x: dateFormater.format(date), y: price });
    }
    setGraphOptions(config);
  }, [product]);


  return (
    <div className="priceGraph descriptionText">
      <h3 className="title">Prishistorikk</h3>
      <div className="graph">
        {graphOptions &&
          <ResponsiveLine
            data={[graphOptions]}
            margin={{
              top: 20,
              right: 20,
              bottom: 40,
              left: 40,
            }}
            yScale={{
              type: "linear",
              min: graphOptions.minPrice * 0.8,
              max: graphOptions.maxPrice * 1.2,
              stacked: false,
              reverse: false,
            }}
            curve="stepBefore"
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
            areaBaselineValue={graphOptions.minPrice * 0.8}
            enableGridX={false}
            colors={{
              datum: "color",
            }}
            lineWidth={3}
            enableArea={true}
            enablePoints={true}
            pointSize={6}
            pointColor="#fdb542"
            pointBorderColor={{ from: 'serieColor' }}
            pointBorderWidth={2}
            areaOpacity={0.5}
            crosshairType="x"
            enableSlices="x"
            sliceTooltip={({ slice }) => {
              return (
                <div
                  style={{
                    background: "#1c323a",
                    padding: "9px 12px",
                    borderRadius: "16px",
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
        }
      </div>
    </div>
  );
}

export default PriceGraph;