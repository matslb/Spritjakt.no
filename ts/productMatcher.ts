import { promises as fs } from "fs";
import {searchCollection} from './services/typesenseService';
import { Product } from "./services/typesense-schema";
import Fuse from "fuse.js";

interface SweProduct{
  productNameBold: string;
  productNameThin: string;
  vintage: string;
  volume: number;
  price: number;
  productId: string;
  alcoholPercentage: number;
  normalizedName: string
}

export async function lookupPriceInSystembolaget(products: Product[]): Promise<SweProduct[]> {
  try {
    const data = await fs.readFile("assortment.json", "utf-8");
    const swedishproducts: SweProduct[] = JSON.parse(data)

    const normalizedSweProducts = swedishproducts.map(swe =>({
      ...swe, 
      normalizedName: normalizeString(`${swe.productNameBold} ${swe.productNameThin}`, swe.volume / 10, swe.alcoholPercentage)})
    );
    const normalizedProducts = products.map(p =>({
      ...p, 
      normalizedName: normalizeString(p.Name, p.Volume, p.Alcohol)})
    );

    const fuse = new Fuse(normalizedSweProducts, { keys: ["normalizedName"], threshold: .05 });

    const fuzzyMatches = normalizedProducts.map(product => {
      const result = fuse.search(product.normalizedName);
      return result.length ? { product, match: result[0].item } : null;
    });

    return fuzzyMatches.filter(match => match).map(match => match!.match);

  } catch (error) {

    console.error("Error reading or parsing JSON:", error);
  }
  return [];
}

const normalizeString = (name: string, volume?:number, alcohol? :number ):string => {
 let normalizedName = prepString(name).split(" ").sort().join(" ").trim();
 return `${normalizedName} ${volume} ${alcohol ?? ""}`;
}
const prepString = (string :string) => JSON.parse(`"${string?.replace(/[^\w\s]/g, "").replace(/\d{4}$/, '')}"`);

searchCollection("Bread & Butter, Pinot Noir")
.then(async results => {
  console.log(results?.length);
  
  const matches = await lookupPriceInSystembolaget(results?.map(p => p.document) ?? []);
  console.log("Matches: " + matches.length);  
});
