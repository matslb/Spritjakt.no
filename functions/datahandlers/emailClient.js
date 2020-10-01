const emailAuth = require("../configs/emailAuth.json");
const fs = require('fs');
const path = require('path');
const emailHeader = fs.readFileSync(path.resolve(__dirname, "./templates/header.txt"), 'utf8');
const emailFooter = fs.readFileSync(path.resolve(__dirname, "./templates/footer.txt"), 'utf8');
const emailProductItem = fs.readFileSync(path.resolve(__dirname, "./templates/productItem.txt"), 'utf8');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(emailAuth.sendgridToken);

const greetings = ["Halla Balla!", "Hei Sveis!", "Sjallabais sjef!", "God dag mann, økseskaft!", "Hallo i luken!", "Heisann Sveisann!", "G'day mate!", "Tittei, her er jeg!"];

module.exports = class EmailClient {

    constructor(products, recipients) {
        this.products = products;
        this.recipients = recipients;
        let { text, html } = this.CreateNewsLetterEmail();
        this.options = {
            from: "Spritjakt.no<varsel@spritjakt.no",
            to: '**Is set later**',
            subject: 'Ny dag, nye priser',
            html: html,
            text: text,
            headers: {}
        };
    }
    CreateNewsLetterEmail() {
        var html = emailHeader.replace(/&Header&/g, greetings[Math.floor(Math.random() * greetings.length)]);
        let subheader = "Det er varer som har fått redusert pris i dag, og det er jo artig!";
        var text = subheader;
        if (this.products.length == 9) {
            subheader += "<br />Her er et utdrag av de beste tilbudene.";
            text += "\nHer er et utdrag av de beste tilbudene:";
        }
        html = html.replace(/&SubHeader&/g, subheader);

        for (const i in this.products) {
            const product = this.products[i];
            var productItem = emailProductItem;
            productItem = productItem.replace(/&ProductTitle&/g, product.Name);
            productItem = productItem.replace(/&NewPrice&/g, product.LatestPrice);
            productItem = productItem.replace(/&OldPrice&/g, product.ComparingPrice);
            productItem = productItem.replace(/&Discount&/g, (product.SortingDiscount - 100).toFixed(1));
            productItem = productItem.replace(/&ProductImageLink&/g, "https://bilder.vinmonopolet.no/cache/100x100/" + product.Id + "-1.jpg");
            productItem = productItem.replace(/&ProductLink&/g, "https://www.vinmonopolet.no/p/" + product.Id);
            productItem = productItem.replace(/&ProductDescription&/g, product.SubType);
            html += productItem;

            text += "\n--------------------------\n"
                + product.Name + " - " + product.SubType
                + "\n\nNy pris: kr " + product.LatestPrice
                + "\nGammel pris: kr " + product.ComparingPrice
                + "\nPrisendring: " + (product.SortingDiscount - 100).toFixed(1) + "%"
            "\n--------------------------\n"
        }

        return { text, html };
    }

    async SendEmails() {

        await this.recipients.forEach(async recipient => {
            var mail = Object.assign({}, this.options);
            mail.to = recipient;
            mail.headers = {
                "List-Unsubscribe": "<https://europe-west1-spritjakt.cloudfunctions.net/removeEmail?email=" + recipient + ">"
            }
            let footer = emailFooter;
            mail.html += footer.replace(/&SignOffURL&/g, "https://europe-west1-spritjakt.cloudfunctions.net/removeEmail?email=" + recipient);
            mail.text += "\n\nBruk denne linken for å melde deg av nyhetsbrevet: https://europe-west1-spritjakt.cloudfunctions.net/removeEmail?email=" + recipient;
            try {
                console.log("sending email");
                await sgMail.send(mail);
            } catch (error) {
                console.log(error);
            }
        });
    }
}

