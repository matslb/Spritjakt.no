export default interface User{
    name: string,
    notifications: NotifcationPreferences
    notificationTokens: string[],
    notificationConsentDate: Date,
    products: string[],
    filters: ProductFilter[]
}

interface NotifcationPreferences{
    byEmail: boolean,
    byPush: boolean, 
    onAll: boolean,
    onFavorites: boolean,
    onFilters: boolean
}

interface ProductFilter{
    countries: string[],
    isGoodFor: string[],
    min: string,
    max: string,
    productTypes: string[],
    volume: string[],
    view: boolean
}