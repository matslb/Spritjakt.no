const emailConfig = require("../configs/emailAuth.json");
const fs = require('fs');
const path = require('path');
const emailHeader = fs.readFileSync(path.resolve(__dirname, "./templates/header.txt"), 'utf8');
const emailFooter = fs.readFileSync(path.resolve(__dirname, "./templates/footer.txt"), 'utf8');
const emailProductItem = fs.readFileSync(path.resolve(__dirname, "./templates/productItem.txt"), 'utf8');
const firebaseAdmin = require("firebase-admin");
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport(emailConfig.smtp_mail);

const sgMail = require('@sendgrid/mail');
const { useForkRef } = require("@material-ui/core");
sgMail.setApiKey(emailConfig.sendgrid.sendgridToken);
const options = {
    from: "Spritjakt.no<varsel@spritjakt.no>",
    to: "",
    subject: "",
    html: "",
    text: "",
    headers: {
        "List-Unsubscribe": "https://spritjakt.no?settings=true&login=true"
    }
};
const greetings = ["Tørst?", "Halla Balla!", "Hei Sveis!", "Sjallabais sjef!", "God dag mann, økseskaft!", "Hallo i luken!", "Heisann Sveisann!", "G'day mate!", "Tittei, her er jeg!"];

module.exports = class NotificationClient {

    static async sendNotifications(products, users) {
        var userFilterMatches = [];
        var userFavoriteMatches = [];
        var onAllUsers = users.filter(u => u.notifications.onAll);

        users.forEach(user => {
            if (user.filters && user.filters.length > 0 && user.notifications.onFilters) {
                user.filters.forEach(filter => {
                    let filterMatchedProducts = products.filter(p =>
                        (!filter.productTypes === undefined || filter.productTypes.length === 0 || filter.productTypes.includes(p.SubType))
                        && (filter.stores === undefined || filter.stores.length === 0 || p.Stock.Stores.find(s => filter.stores.includes(s.name) || (filter.stores.includes("online") && !["Utgått", "Utsolgt"].includes(p.ProductStatusSaleName)))));
                    if (filterMatchedProducts.length > 0) {
                        userFilterMatches.push({
                            user: user,
                            filter: filter,
                            products: filterMatchedProducts
                        });
                    }
                });
            }
            if (user.products && user.products.length > 0 && user.notifications.onFavorites) {
                let favoriteMatchedProducts = products.filter(p => user.products.includes(p.Id));
                if (favoriteMatchedProducts.length > 0) {
                    userFavoriteMatches.push({
                        user: user,
                        products: favoriteMatchedProducts
                    });
                }
            }
        });

        userFilterMatches.forEach(async userFilterMatch => {
            if (userFilterMatch.user.notifications.byEmail) {
                let email = this.CreateFilterEmail(userFilterMatch);
                await this.SendEmail(email);
            }
            if (userFilterMatch.user.notifications.byPush) {
                await this.SendFilterPush(userFilterMatch);
            }
        });

        userFavoriteMatches.forEach(async userFavoriteMatch => {
            if (userFavoriteMatch.user.notifications.byEmail) {
                let email = this.CreateFavoritesEmail(userFavoriteMatch);
                await this.SendEmail(email);
            }
            if (userFavoriteMatch.user.notifications.byPush) {
                await this.SendFavoritesPush(userFavoriteMatch);
            }
        });

        onAllUsers.forEach(async user => {
            if (user.notifications.byEmail) {
                let email = this.CreateNewsLetterEmail(products);
                email.to = user.email;
                await this.SendEmail(email);
            }
            if (user.notifications.byPush) {
                await this.SendAllPush(user, products.length);
            }
        });

    }

    static CreateNewsLetterEmail(products) {
        let greeting = greetings[Math.floor(Math.random() * greetings.length)];
        let subheader = "Det er nye tilbud i dag, og det er jo artig!";
        let email = this.CreateEmail(greeting, subheader, products);
        email.subject = "Ny dag, nye priser";
        return email;
    }

    static CreateFilterEmail(userFilterMatch) {
        let greeting = userFilterMatch.user.name ? "Hei " + userFilterMatch.user.name : greetings[Math.floor(Math.random() * greetings.length)];
        let subject = "Ditt lagrede filter har fått " + userFilterMatch.products.length + " nye tilbud!";
        let subheader = subject;
        let email = this.CreateEmail(greeting, subheader, userFilterMatch.products);
        email.to = userFilterMatch.user.email;
        email.subject = subject;
        return email;
    }

    static CreateFavoritesEmail(userFavoriteMatch) {
        let greeting = userFavoriteMatch.user.name ? "Hei " + userFavoriteMatch.user.name : greetings[Math.floor(Math.random() * greetings.length)];
        let subheader = userFavoriteMatch.products.length + " av favorittene dine er på tilbud!";
        let email = this.CreateEmail(greeting, subheader, userFavoriteMatch.products);
        email.to = userFavoriteMatch.user.email;
        email.subject = subheader;
        return email;
    }

    static async SendAllPush(user, count) {

        let message = {
            notification: {
                title: "Pssst.. " + user.name,
                body: "Det er " + count + " nye tilbud i dag, og det er jo artig!",
                image: "https://spritjakt.no/logo.png"
            },
            webpush: {
                fcm_options: {
                    link: "https://spritjakt.no?source=push"
                }
            },
            topic: user.id
        };
        await this.SendPush(message);
    }

    static async SendFilterPush(userFilterMatch) {
        let urlParams = userFilterMatch.filter.productTypes.length > 0 ? "filter=" + userFilterMatch.filter.productTypes.join() : "";
        urlParams += userFilterMatch.filter.stores.length > 0 ? "&stores=" + userFilterMatch.filter.stores.join() : "";

        let message = {
            notification: {
                title: "Filteret ditt har fått nye " + userFilterMatch.products.length + " tilbud!",
                body: "Klikk her for å lese mer.",
                image: "https://spritjakt.no/logo.png"
            },
            webpush: {
                fcm_options: {
                    link: "https://spritjakt.no?source=push" + urlParams
                }
            },
            topic: userFilterMatch.user.id
        };
        await this.SendPush(message);
    }

    static async SendFavoritesPush(userFavoriteMatch) {
        let message = {
            notification: {
                title: "",
                body: "",
                image: "https://spritjakt.no/logo.png"
            },
            webpush: {
                fcm_options: {
                    link: "https://spritjakt.no?source=push&settings=true"
                }
            },
            topic: userFavoriteMatch.user.id
        };
        await userFavoriteMatch.products.forEach(async p => {

            if (p.Name.length > 20) {
                message.notification.title = p.Name.slice(0, 20) + "(...) er på tilbud!";
            } else {
                message.notification.title = p.Name + " er på tilbud!";
            }

            message.notification.body = "En endring på " + (p.SortingDiscount - 100).toFixed(1) + "%";

            await this.SendPush(message);
        });
    }

    static async SendPush(message) {
        await firebaseAdmin.messaging().send(message)
            .then((response) => {
                console.log('Successfully sent message:', response);
            })
            .catch((error) => {
                console.log('Error sending message:', error);
            });
    }

    static CreateEmail(greeting, subheader, products) {
        let email = options;
        let footer = emailFooter;

        email.html = emailHeader.replace(/&Header&/g, greeting);
        email.text = subheader;

        if (products.length > 10) {
            subheader += "<br />Her er et utdrag av de beste tilbudene.";
            email.text += "\nHer er et utdrag av de beste tilbudene:";
            products = products.slice(0, 9);
        }
        email.html = email.html.replace(/&SubHeader&/g, subheader);

        email.html += this.addProductListBlock(products);
        email.text += this.addProductListTextBlock(products);

        email.html += footer.replace(/&SignOffURL&/g, "https://spritjakt.no?settings=true&login=true");
        email.text += "\n\nEndre varslingsinnstillingene her: https://spritjakt.no?settings=true&login=true";

        return email;
    }

    static addProductListTextBlock(products) {
        let text = "";
        for (const i in products) {
            const product = products[i];
            text += "\n--------------------------\n"
                + product.Name + " - " + product.SubType
                + "\n\nNy pris: kr " + product.LatestPrice
                + "\nGammel pris: kr " + product.ComparingPrice
                + "\nPrisendring: " + (product.SortingDiscount - 100).toFixed(1) + "%"
                + "\n--------------------------\n"
        }
        return text;
    }

    static addProductListBlock(products) {
        let html = "";
        for (const i in products) {
            const product = products[i];
            var productItem = emailProductItem;
            productItem = productItem.replace(/&ProductTitle&/g, product.Name);
            productItem = productItem.replace(/&NewPrice&/g, product.LatestPrice);
            productItem = productItem.replace(/&OldPrice&/g, product.ComparingPrice);
            productItem = productItem.replace(/&Discount&/g, (product.SortingDiscount - 100).toFixed(1));
            productItem = productItem.replace(/&ProductImageLink&/g, "https://bilder.vinmonopolet.no/cache/100x100/" + product.Id + "-1.jpg");
            productItem = productItem.replace(/&ProductLink&/g, "https://www.vinmonopolet.no/p/" + product.Id);
            productItem = productItem.replace(/&ProductDescription&/g, product.SubType);
            html += productItem;
        }
        return html;
    }

    static async SendEmail(email) {
        try {
            console.log("Sending smtp email");
            let result = await transporter.sendMail(email);
            console.log(result);

        } catch (error) {
            console.log(error);
        }
    }
}

