// typesenseClient.ts

import Typesense from 'typesense';
import { Product } from './typesense-schema';
import config from '../config';

// Initialize Typesense client
const typesense = new Typesense.Client({
  nodes: [
    {
      host: config.typeSense.host,
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: config.typeSense.publicKey,
  connectionTimeoutSeconds: 2
});

// Function to search the collection
export async function searchCollection(query: string) {
  try {
    const searchParameters = {
      q: query,
      query_by: 'Name',
      per_page: 20
    };

    const searchResults = await typesense.collections<Product>('Products_v1.52')
      .documents()
      .search(searchParameters);

    return searchResults.hits;
  } catch (error) {
    console.error('Error searching collection:', error);
    return null;
  }
}

// Function to retrieve a document by ID
export async function getDocumentById(id: string) {
  try {
    const document = await typesense.collections<Product>('Products_v1.52')
      .documents(id)
      .retrieve();

    return document;
  } catch (error) {
    console.error('Error retrieving document:', error);
    return null;
  }
}
