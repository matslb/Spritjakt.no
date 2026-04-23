import React, { useCallback, useEffect, useLayoutEffect } from "react";
import Quagga from "@ericblade/quagga2";
import { isMobile } from "react-device-detect";

function getMedian(arr) {
  arr.sort((a, b) => a - b);
  const half = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) {
    return arr[half];
  }
  return (arr[half - 1] + arr[half]) / 2;
}

function getMedianOfCodeErrors(decodedCodes) {
  const errors = decodedCodes
    .filter((x) => x.error !== undefined)
    .map((x) => x.error);
  const medianOfErrors = getMedian(errors);
  return medianOfErrors;
}

const defaultConstraints = {
  width: {
    min: 640,
  },
  height: {
    min: 480,
  },
};

const defaultLocatorSettings = {
  patchSize: "medium",
  halfSample: true,
};

const defaultDecoders = ["ean_reader"];

const Scanner = ({
  hasProduct,
  onDetected,
  scannerRef,
  onScannerReady,
  cameraId,
  useTorch,
  constraints = defaultConstraints,
  locator = defaultLocatorSettings,
  numOfWorkers = navigator.hardwareConcurrency || 0,
  decoders = defaultDecoders,
  locate = true,
}) => {
  const errorCheck = useCallback(
    (result) => {
      if (!onDetected) {
        return;
      }
      const err = getMedianOfCodeErrors(result.codeResult.decodedCodes);
      if (err < 0.1) {
        onDetected(result.codeResult.code);
      }
    },
    [onDetected]
  );

  useEffect(() => {
    if (hasProduct) return;
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          constraints: {
            aspectRatio: {
              min: 1,
              max: 2,
            },
            focusMode: "continuous",
            ...(!cameraId && { facingMode: "environment" }),
            ...(cameraId && { deviceId: cameraId }),
          },
          target: scannerRef.current,
        },
        locator,
        numOfWorkers,
        decoder: { readers: decoders },
        locate,
      },
      (err) => {
        if (err) {
          return console.log("Error starting Quagga:", err);
        }
        if (scannerRef && scannerRef.current) {
          Quagga.start();
          var track = Quagga.CameraAccess.getActiveTrack();
          if (isMobile) {
            track.applyConstraints({ advanced: [{ torch: useTorch }] });
          }
          if (onScannerReady) {
            onScannerReady();
          }
        }
      }
    );

    Quagga.onDetected(errorCheck);
    return () => {
      Quagga.offDetected(errorCheck);
      Quagga.stop();
    };
  }, [
    cameraId,
    onDetected,
    onScannerReady,
    scannerRef,
    errorCheck,
    constraints,
    locator,
    decoders,
    locate,
  ]);
  return null;
};

export default Scanner;
