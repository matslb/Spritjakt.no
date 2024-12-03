export default interface FireStoreProduct {
    Acid: string;
    Alcohol: number;
    AvailableOnline: boolean;
    Buyable: boolean;
    Color: string;
    Country: string;
    District: string;
    Expired: boolean;
    Freshness: number;
    Fullness: number;
    Id: string;
    Ingredients: Array<{
      code: string;
      formattedValue: string;
      readableValue: string;
    }>;
    IsGoodFor: Array<{
      code: string;
      name: string;
    }>;
    IsGoodForList: string[];
    IsVintage: boolean;
    LastPriceFetchDate: FirebaseFirestore.Timestamp; 
    LastUpdated: number; 
    LatestPrice: number;
    LiterPriceAlcohol: number;
    Literprice: number;
    Name: string;
    Price: number;
    PriceChange: number;
    PriceChanges: number;
    PriceHistory: Record<string, number>;
    PriceHistorySorted: string[];
    PriceIsLowered: boolean;
    ProductStatusSaleName: string;
    ReleaseMode: boolean;
    Smell: string;
    Status: string;
    StoragePotential: {
      code: string;
      formattedValue: string;
    };
    Stores: string[];
    SubDistrict: string | null;
    Sugar: string;
    Sulfates: string | null;
    Sweetness: number;
    Taste: string;
    Type: string;
    Types: string[];
    VintageComment: string;
    VivinoRating: number;
    Volume: number;
    Year: string;
  }
  