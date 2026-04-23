const emailConfig = require("../configs/emailAuth.json");
const fs = require("fs");
const path = require("path");
const emailHeader = fs.readFileSync(
  path.resolve(__dirname, "./templates/header.txt"),
  "utf8"
);
const emailFooter = fs.readFileSync(
  path.resolve(__dirname, "./templates/footer.txt"),
  "utf8"
);
const emailProductItem = fs.readFileSync(
  path.resolve(__dirname, "./templates/productItem.txt"),
  "utf8"
);
const firebaseAdmin = require("firebase-admin");
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: emailConfig.mailgun.apiKey,
  url: "https://api.eu.mailgun.net",
});

const options = {
  from: "Spritjakt.no<varsel@mg.spritjakt.no>",
  to: "",
  subject: "",
  html: "",
  text: "",
  headers:
    'a:1:{s:16:"List-Unsubscribe";s:45:"https://spritjakt.no?settings=true&login=true";}',
};
const greetings = [
  "Tørst?",
  "Halla balla!",
  "Hei sveis!",
  "Cheers, mate!",
  "Åssen går det?",
  "Tittei, her er jeg!",
  "Skål!",
];

module.exports = class NotificationClient {
  static async sendNotifications(products, users) {
    var userFilterMatches = [];
    var userFavoriteMatches = [];
    var onAllUsers = users.filter((u) => u.notifications.onAll);

    users.forEach((user) => {
      if (
        user.filters &&
        user.filters.length > 0 &&
        user.notifications.onFilters
      ) {
        user.filters.forEach((filter) => {
          let filterMatchedProducts = products.filter(
            (p) =>
              this.ProductHasFilterTypes(p, filter) &&
              this.ProductHasCountry(p, filter) &&
              this.ProductIsInFilterStore(p, filter) &&
              this.ProductPriceIsInRange(p, filter)
          );
          if (filterMatchedProducts.length > 0) {
            userFilterMatches.push({
              user: user,
              filter: filter,
              products: filterMatchedProducts,
            });
          }
        });
      }
      if (
        user.products &&
        user.products.length > 0 &&
        user.notifications.onFavorites
      ) {
        let favoriteMatchedProducts = products.filter((p) =>
          user.products.includes(p.Id)
        );
        if (favoriteMatchedProducts.length > 0) {
          userFavoriteMatches.push({
            user: user,
            products: favoriteMatchedProducts,
          });
        }
      }
    });

    for (const userFilterMatch of userFilterMatches) {
      if (userFilterMatch.user.notifications.byEmail) {
        let email = this.CreateFilterEmail(userFilterMatch);
        await this.SendEmail(email);
      }
      if (userFilterMatch.user.notifications.byPush) {
        await this.SendFilterPush(userFilterMatch);
      }
    }

    for (const userFavoriteMatch of userFavoriteMatches) {
      if (userFavoriteMatch.user.notifications.byEmail) {
        let email = this.CreateFavoritesEmail(userFavoriteMatch);
        await this.SendEmail(email);
      }
      if (userFavoriteMatch.user.notifications.byPush) {
        await this.SendFavoritesPush(userFavoriteMatch);
      }
    }

    for await (const user of onAllUsers) {
      if (user.notifications.byEmail) {
        let email = this.CreateNewsLetterEmail(products);
        email.to = user.email;
        await this.SendEmail(email);
      }
      if (user.notifications.byPush) {
        await this.SendAllPush(user, products.length);
      }
    }
  }

  static ProductHasFilterTypes(product, filter) {
    return (
      filter.productTypes === undefined ||
      filter.productTypes.length === 0 ||
      product.Types?.find((t) => filter.productTypes.includes(t))
    );
  }
  static ProductHasCountry(product, filter) {
    return (
      filter.countries === undefined ||
      filter.countries.length === 0 ||
      filter.countries.includes(product.Country[0])
    );
  }
  static ProductIsInFilterStore(product, filter) {
    return (
      filter.stores === undefined ||
      filter.stores.length === 0 ||
      product.Stores?.find((s) => filter.stores.includes(s))
    );
  }
  static ProductPriceIsInRange(product, filter) {
    return (
      (filter.min === undefined ||
        filter.min === null ||
        product.LatestPrice >= filter.min) &&
      (filter.max === undefined ||
        filter.max === null ||
        product.LatestPrice <= filter.max)
    );
  }

  static CreateNewsLetterEmail(products) {
    let greeting = greetings[Math.floor(Math.random() * greetings.length)];
    let subheader = "Spritjakt har oppdaget noen nye prisfall";
    let email = this.CreateEmail(greeting, subheader, products);
    email.subject = "Ny dag, nye priser";
    return email;
  }

  static async SendFetchErrorEmail(text) {
    let email = options;
    email.to = "mats@spritjakt.no";
    email.subject = "Daglig jobb feilet";
    email.text = text;
    await this.SendEmail(email);
  }

  static CreateFilterEmail(userFilterMatch) {
    let urlParams =
      userFilterMatch.filter.productTypes &&
      userFilterMatch.filter.productTypes.length > 0
        ? "&types=" + userFilterMatch.filter.productTypes.join()
        : "";
    urlParams +=
      userFilterMatch.filter.stores && userFilterMatch.filter.stores.length > 0
        ? "&stores=" + userFilterMatch.filter.stores.join()
        : "";
    urlParams +=
      userFilterMatch.filter.countries &&
      userFilterMatch.filter.countries.length > 0
        ? "&countries=" + userFilterMatch.filter.countries.join()
        : "";

    let greeting = userFilterMatch.user.name
      ? "Hei " + userFilterMatch.user.name
      : greetings[Math.floor(Math.random() * greetings.length)];
    let subject =
      "Filteret ditt har fått " +
      userFilterMatch.products.length +
      (userFilterMatch.products.length > 1 ? " nye" : " nytt") +
      " prisfall!";
    let subheader = subject;
    let email = this.CreateEmail(
      greeting,
      subheader,
      userFilterMatch.products,
      urlParams
    );
    email.to = userFilterMatch.user.email;
    email.subject = subject;
    return email;
  }

  static CreateFavoritesEmail(userFavoriteMatch) {
    let greeting = userFavoriteMatch.user.name
      ? "Hei " + userFavoriteMatch.user.name
      : greetings[Math.floor(Math.random() * greetings.length)];
    let subheader =
      userFavoriteMatch.products.length +
      " av favorittene dine er satt ned i pris!";
    let email = this.CreateEmail(
      greeting,
      subheader,
      userFavoriteMatch.products
    );
    email.to = userFavoriteMatch.user.email;
    email.subject = subheader;
    return email;
  }

  static async SendAllPush(user, count) {
    let message = {
      notification: {
        title: "Pssst.. " + user.name,
        body:
          "Det er " +
          count +
          (count > 1 ? " nye" : " nytt") +
          " prisfall i dag, og det er jo artig!",
        image: "https://spritjakt.no/logo.jpg",
      },
      webpush: {
        fcm_options: {
          link: "https://spritjakt.no?source=push",
        },
      },
      topic: user.id,
    };
    await this.SendPush(message);
  }

  static async SendFilterPush(userFilterMatch) {
    let urlParams =
      userFilterMatch.filter.productTypes.length > 0
        ? "types=" + userFilterMatch.filter.productTypes.join()
        : "";
    urlParams +=
      userFilterMatch.filter.stores.length > 0
        ? "&stores=" + userFilterMatch.filter.stores.join()
        : "";

    let message = {
      notification: {
        title:
          "Filteret ditt har fått " +
          userFilterMatch.products.length +
          (userFilterMatch.products.length > 1 ? " nye" : " nytt") +
          " prisfall!",
        body: "Klikk her for å lese mer.",
        image: "https://spritjakt.no/logo.jpg",
      },
      webpush: {
        fcm_options: {
          link: "https://spritjakt.no?source=push&" + urlParams,
        },
      },
      topic: userFilterMatch.user.id,
    };
    await this.SendPush(message);
  }

  static async SendFavoritesPush(userFavoriteMatch) {
    let message = {
      notification: {
        title: "",
        body: "",
        image: "https://spritjakt.no/logo.jpg",
      },
      webpush: {
        fcm_options: {
          link: "https://spritjakt.no?source=push&settings=true",
        },
      },
      topic: userFavoriteMatch.user.id,
    };
    await userFavoriteMatch.products.forEach(async (p) => {
      if (p.Name.length > 20) {
        message.notification.title =
          p.Name.slice(0, 20) + "(...) er på satt ned i pris!";
      } else {
        message.notification.title = p.Name + " er satt ned i pris!";
      }

      message.notification.body =
        "En endring på " + (p.PriceChange - 100).toFixed(1) + "%";

      await this.SendPush(message);
    });
  }

  static CreateEmail(greeting, subheader, products, urlParams = "") {
    let email = options;
    let footer = emailFooter;

    email.html = emailHeader.replace(/&Header&/g, greeting);
    email.text = subheader;

    if (products.length > 10) {
      subheader += "<br />Her er et utdrag av de største prisfallene.";
      email.text += "\nHer er et utdrag av de største prisfallene:";
      products = products.slice(0, 9);
    }
    email.html = email.html.replace(/&SubHeader&/g, subheader);

    email.html += this.addProductListBlock(products, urlParams);
    email.text += this.addProductListTextBlock(products);

    email.html += footer.replace(
      /&SignOffURL&/g,
      "https://spritjakt.no?settings=true&login=true"
    );
    email.text +=
      "\n\nEndre varslingsinnstillingene her: https://spritjakt.no?settings=true&login=true";

    return email;
  }
  static getComparingPrice(p) {
    return p.PriceHistory[p.PriceHistorySorted[1]];
  }

  static addProductListTextBlock(products) {
    let text = "";
    for (const i in products) {
      const product = products[i];
      text +=
        "\n--------------------------\n" +
        product.Name +
        " - " +
        product.Types?.join() +
        "\n\nNy pris: kr " +
        product.LatestPrice +
        "\nGammel pris: kr " +
        this.getComparingPrice(product) +
        "\nPrisendring: " +
        (product.PriceChange - 100).toFixed(1) +
        "%" +
        "\n--------------------------\n";
    }
    return text;
  }

  static addProductListBlock(products, urlParams) {
    let html = "";
    for (const i in products) {
      const product = products[i];
      var productItem = emailProductItem;
      productItem = productItem.replace(/&ProductTitle&/g, product.Name);
      productItem = productItem.replace(/&NewPrice&/g, product.LatestPrice);
      productItem = productItem.replace(
        /&OldPrice&/g,
        this.getComparingPrice(product)
      );
      productItem = productItem.replace(
        /&Discount&/g,
        (product.PriceChange - 100).toFixed(1)
      );
      productItem = productItem.replace(
        /&ProductImageLink&/g,
        `https://bilder.vinmonopolet.no/cache/300x300-0/${product.Id}-1.jpg`
      );
      productItem = productItem.replace(
        /&ProductLink&/g,
        "https://spritjakt.no/?source=email&product=" + product.Id + urlParams
      );
      productItem = productItem.replace(
        /&ProductDescription&/g,
        product.Types?.join() ?? ""
      );
      html += productItem;
    }
    return html;
  }

  static async SendEmail(email) {
    mg.messages
      .create(emailConfig.mailgun.domain, email)
      .then((msg) => console.log(msg))
      .catch((err) => console.log(err));

    await sleep(500);
  }

  static async SendPush(message) {
    await firebaseAdmin
      .messaging()
      .send(message)
      .then((response) => {
        console.log("Successfully sent message:", response);
      })
      .catch((error) => console.error("Error sending message:", error));
  }
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
