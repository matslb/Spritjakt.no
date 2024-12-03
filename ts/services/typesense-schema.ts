export interface Product {
    Name: string;                          // Required string
    Id: string;                            // Required string
    Country?: string;                      // Optional string
    Volume?: number;                       // Optional float
    Alcohol: number;
    Types: string[];                       // Required array of strings
    LatestPrice?: number;                  // Optional float
    PriceIsLowered?: boolean;              // Optional boolean
    PriceChange?: number;                  // Optional float
    LiterPriceAlcohol?: number;            // Optional float
    Literprice?: number;                   // Optional float
    Rating?: number;                       // Optional int32
    LastUpdated: number;                   // Required int64
    Buyable?: boolean;                     // Optional boolean
    Stores: string[];                      // Required array of strings
    IsGoodForList?: string[];              // Optional array of strings
    PriceChanges?: number;                 // Optional int32
    IsVintage?: boolean;                   // Optional boolean
    Expired?: boolean;                     // Optional boolean
    VivinoRating?: number;                 // Optional float
    Year: string;
    normalizedName: string
    SwedishPriceDiff?: number;
  }