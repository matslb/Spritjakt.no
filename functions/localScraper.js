import FirebaseClient from "./datahandlers/firebaseClient.js";
import VmpClient from "./datahandlers/vmpClient.js";
import serviceAccount from "./configs/serviceAccountKey.js";
import NotificationClient from "./datahandlers/notificationService.js";
import firebase from "firebase-admin";
import fs from "node:fs";
import {exec} from "node:child_process";
import * as util from "node:util";
import path from "node:path";
import {fileURLToPath} from "node:url";
import dns from 'dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://spritjakt.firebaseio.com/",
});

const log_stdout = process.stdout;
let log_file;

const log_File_name = () => {
    const date = new Date();
    return path.join(__dirname, "logs", `${date.toISOString().slice(0, 10)}.log`);
};

const customLog = (message, useConsole = false) => {
    log_file.write(util.format(`${(new Date()).toLocaleString()} - ${message}`) + "\n");
    if (useConsole) log_stdout.write(util.format(message) + "\n");
};

orchistrator();

async function orchistrator() {
    let lastRunDate = -1;

    while (true) {
        const time = new Date();

        const runhour =
            process.argv.length > 2
                ? Number(process.argv[2])
                : time.getHours();

        const nextRunTime = new Date();
        nextRunTime.setHours(runhour, 0, 0, 0);

        if (
            time.getHours() > runhour ||
            lastRunDate === nextRunTime.getDate()
        ) {
            nextRunTime.setDate(nextRunTime.getDate() + 1);
        }

        const msLeft = Math.abs(nextRunTime.getTime() - time.getTime());

        if (time.getHours() === runhour && lastRunDate !== time.getDate()) {
            lastRunDate = time.getDate();

            log_file = fs.createWriteStream(log_File_name(), {flags: "w"});

            customLog(`Current time: ${(new Date()).toLocaleString()}`);
            await UpdatePrices();

            customLog(
                `Finished run. It took ${new Date(Date.now() - time)
                    .toISOString()
                    .slice(11, 19)} hours.`,
                true
            );

            reConnectToVpn("Norway", 0);
        } else {
            log_stdout.write(
                `Not yet.. Sleeping for ${new Date(nextRunTime - time)
                    .toISOString()
                    .slice(11, 19)}\n`
            );

            await new Promise((r) => setTimeout(r, msLeft));
        }
    }
}

async function UpdatePrices() {

    const newProducts = await VmpClient.GetNewProductList();
    const newProductIds = newProducts.map((p) => p.Id);
    // TODO: Fix vintages failing. Possibly because of missing data?
    if (newProductIds.length > 0) {
        customLog(`Checking if ${newProductIds.length} products not in db`, true);

        const idsNotFound = await FirebaseClient.GetIdsNotInDb(newProductIds);

        if (idsNotFound.length > 0) {
            customLog(
                `${idsNotFound.length} new products found. Creating them in database`,
                true
            );
        }

        for (const [index, id] of idsNotFound.entries()) {
            process.stdout.write(
                `\r${index} of ${idsNotFound.length} Created`
            );

            try {
                const response =
                    await VmpClient.GetProductDetailsWithStock(id, true);

                if (response.product) {
                    await FirebaseClient.UpsertProduct(response.product);
                }

                await new Promise((r) =>
                    setTimeout(r, Math.random() * 1500)
                );
            } catch (e) {
                customLog(e, true);
                return;
            }
        }
    }

    customLog("Starting Product price fetch", true);
    const products = await FirebaseClient.GetProductsToBeUpdated();
    const p_batches = chunk(products, 30);

    let failcount = 0;
    let totalErrors = 0;
    let totalExpired = 0;

    const start = Date.now();
    let statusMessage = "";

    const progressbarWidth = 20;

    for (const batch of p_batches) {
        await reConnectToVpn(getVpnCountry(), (Math.random() * 15000) + 5000);

        const db_batch = firebase.firestore().batch();

        for (const product of batch) {
            console.clear();

            const processed = products.indexOf(product) + 1;
            const percentage = processed / products.length;

            const filled = Math.floor(progressbarWidth * percentage);
            const empty = progressbarWidth - filled;

            const left = products.length - processed;

            const elapsed = Date.now() - start;

            const elapsedString = new Date(elapsed)
                .toISOString()
                .slice(11, 19);

            const remainingString = new Date((elapsed / (processed + 1)) * left).toISOString().slice(11, 19);

            statusMessage = `[${"=".repeat(filled)}${".".repeat(empty)}] ${(percentage * 100).toFixed(0)}% | Fetched ${processed} of ${products.length} products | Expired: ${totalExpired} | Errors: ${totalErrors} | Elapsed: ${elapsedString} | Remaining: ${remainingString} `;

            process.stdout.write(`\r${statusMessage}`);

            try {
                const detailsRes =
                    await VmpClient.GetProductDetailsWithStock(
                        product.Id,
                        false
                    );

                if (detailsRes.product) {
                    const found = await FirebaseClient.UpdateProduct(
                        db_batch,
                        product,
                        detailsRes.product
                    );

                    if (!found) {
                        customLog(`Could not update Product ${product.Id}`);
                    }

                    failcount = 0;
                } else if (detailsRes.error) {
                    customLog(
                        `Could not fetch price of product ${product.Id}. Error: ${detailsRes.error}`
                    );

                    failcount++;
                    totalErrors++;

                    if (detailsRes.statusCode === 429) {
                        customLog(
                            `Rate limited (429). Attempting to re-connect VPN`
                        );
                        await reConnectToVpn(getVpnCountry(), 60000);
                    }
                } else {
                    customLog(
                        `Product ${product.Id} was not found. Marking as 'Expired'`
                    );

                    totalExpired++;
                    await FirebaseClient.ExpireProduct(
                        db_batch,
                        product.Id
                    );

                    failcount = 0;
                }

                if (failcount > 5) {
                    await NotificationClient.SendFetchErrorEmail(statusMessage);
                    customLog(`${failcount} products failed in a row. Aborting.`, true);
                    return;
                }

                await new Promise((r) => setTimeout(r, (Math.random() * 800) + 400));
            } catch (e) {
                customLog(`Pricefetch failed. Error: ${e}`, true);
            }
        }

        await db_batch.commit();
        customLog(statusMessage, true);
    }

    customLog(statusMessage);
}

async function reConnectToVpn(country, sleepTime) {

    customLog("", true);

    exec(`vpnConnector.cmd ${country}`, {encoding: "utf-8"});

    customLog(`Connecting to ${country}. Waiting ${(sleepTime / 1000).toFixed(0)} seconds...`, true);

    await new Promise((r) => setTimeout(r, sleepTime));
}

function getVpnCountry() {
    const countries = [
        "Norway",
        "Germany",
        "Sweden",
        "Denmark",
        "Finland",
    ];

    return countries[Math.floor(Math.random() * countries.length)];
}

const chunk = (arr, size) =>
    Array.from(
        {length: Math.ceil(arr.length / size)},
        (_, i) => arr.slice(i * size, i * size + size)
    );