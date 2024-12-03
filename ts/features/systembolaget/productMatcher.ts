import { promises as fs } from "fs";
import { searchCollection } from "./services/typesenseService";
const firebaseAdminCert = require("../../js/functions/configs/serviceAccountKey.json");
import { Product } from "./services/typesense-schema";
import Fuse from "fuse.js";
const admin = require('firebase-admin');
import { getFirestore } from "firebase-admin/firestore";

const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseAdminCert),
    databaseURL: "https://spritjakt.firebaseio.com"
 });

const db = getFirestore(app);

interface SweProduct {
  productNameBold: string;
  productNameThin: string;
  vintage: string;
  volume: number;
  price: number;
  productId: string;
  alcoholPercentage: number;
  normalizedName: string;
}

interface Match {
  product?: Product;
  match?: SweProduct;
}

export const lookupPriceInSystembolaget = async (products: Product[]) => {
  try {
    const data = await fs.readFile("assortment.json", "utf-8");
    const swedishproducts: SweProduct[] = JSON.parse(data);

    const normalizedSweProducts = swedishproducts.map((swe) => ({
      ...swe,
      normalizedName: normalizeString(
        `${swe.productNameBold} ${swe.productNameThin}`,
        swe.volume / 10,
        swe.alcoholPercentage
      ),
    }));
    const normalizedProducts = products.map((p) => ({
      ...p,
      normalizedName: normalizeString(p.Name, p.Volume, p.Alcohol),
    }));

    const fuse = new Fuse(normalizedSweProducts, {
      keys: ["normalizedName"],
      threshold: 0.04,
    });

    const fuzzyMatches: Match[] = normalizedProducts.map((product) => {
      const result = fuse.search(product.normalizedName);
      if (result.length === 0) return {};
      return {
        product: product,
        match: result[0].item,
      };
    });

    return fuzzyMatches.filter((match) => match.match !== undefined);
  } catch (error) {
    console.error("Error reading or parsing JSON:", error);
  }
  return [];
};

const normalizeString = (
  name: string,
  volume?: number,
  alcohol?: number
): string => {
  try {
    let normalizedName = prepString(name).split(" ").sort().join(" ").trim();
    return `${normalizedName} ${volume} ${alcohol ?? ""}`;
  } catch (error) {
    console.error("Error normalizing string:", error);
  }
  return "";
};

const prepString = (string: string) => {
  string = JSON.parse(`"${string.replace(/"/g, "")}"`); // decoding string to replace url-encoded characters
  string = string.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  string = string.replace(/[^\w\s]/g, ""); // remove special characters
  string = string.replace(/\d{4}$/, ""); // remove year from title
  return string;
};

searchCollection("Bread & Butter Chardonnay 2018").then(async (results) => {
  console.log(results?.length);

  const matches = await lookupPriceInSystembolaget(
    results?.map((p) => p.document) ?? []
  );
  matches?.forEach((m) =>
    console.log(m.match?.normalizedName + " - " + m.product?.normalizedName)
  );
  console.log("Matches: " + matches.length);
  matches.forEach((matchPair) => {
    const productRef = db.collection("Products").doc(matchPair.product!.Id);
      console.log("Updating document: " + matchPair.product!.Id);
    // Update the price difference as point value in the Firestore document
    productRef.update("SwedishPriceDiff", matchPair.product!.LatestPrice! / matchPair.match!.price)
      .then(() => {
        console.log("Document successfully updated!");
      })
      .catch(console.log);
  });
});
