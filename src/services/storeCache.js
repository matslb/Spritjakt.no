class StoreCacher {
  static set(stores) {
    localStorage.setItem("SPRITJAKT_STORES", JSON.stringify(stores));
  }
  static get() {
    let string = localStorage.getItem("SPRITJAKT_STORES");
    if (string) {
      return JSON.parse(string);
    }
    return false;
  }
}

export default StoreCacher;
