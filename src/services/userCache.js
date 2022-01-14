class UserCacher {
    static set(userData) {
        delete userData.NotificationTokens;
        localStorage.setItem("SPRITJAKT_USER", JSON.stringify(userData))
    }
    static get() {
        let string = localStorage.getItem("SPRITJAKT_USER");
        if (string) {
            return JSON.parse(string);
        }
        return false;
    }
    static delete() {
        localStorage.setItem("SPRITJAKT_USER", "");
    }
}

export default UserCacher;