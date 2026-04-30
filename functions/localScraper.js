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
import dns from "dns";

// ── Configuration ──────────────────────────────────────────────────────────────

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_CONSECUTIVE_FAILURES = 5;
const BATCH_SIZE = 30;
const PROGRESS_BAR_WIDTH = 20;

const VPN_COUNTRIES = ["Norway", "Germany", "Sweden", "Denmark", "Finland"];

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://spritjakt.firebaseio.com/",
});

// ── Logging ────────────────────────────────────────────────────────────────────

let logFile;

function getLogFilePath() {
    const date = new Date();
    return path.join(__dirname, "logs", `${date.toISOString().slice(0, 10)}.log`);
}

function customLog(message, useConsole = false) {
    logFile.write(util.format(`${new Date().toLocaleString()} - ${message}`) + "\n");
    if (useConsole) {
        process.stdout.write(util.format(message) + "\n");
    }
}

// ── Utility helpers ────────────────────────────────────────────────────────────

function chunk(arr, size) {
    return Array.from(
        {length: Math.ceil(arr.length / size)},
        (_, i) => arr.slice(i * size, i * size + size)
    );
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function randomSleep(min, max) {
    return sleep(Math.random() * (max - min) + min);
}

function formatDuration(ms) {
    return new Date(ms).toISOString().slice(11, 19);
}

function getRandomVpnCountry() {
    return VPN_COUNTRIES[Math.floor(Math.random() * VPN_COUNTRIES.length)];
}

async function reconnectToVpn(country, sleepTime) {
    customLog("", true);
    exec(`vpnConnector.cmd ${country}`, {encoding: "utf-8"});
    customLog(`Connecting to ${country}. Waiting ${(sleepTime / 1000).toFixed(0)} seconds...`, true);
    await sleep(sleepTime);
}

// ── Progress display ───────────────────────────────────────────────────────────

function buildProgressMessage({processed, total, totalExpired, totalErrors, totalCreated, startTime}) {
    const percentage = processed / total;
    const filled = Math.floor(PROGRESS_BAR_WIDTH * percentage);
    const empty = PROGRESS_BAR_WIDTH - filled;
    const elapsed = Date.now() - startTime;
    const remaining = (elapsed / (processed + 1)) * (total - processed);

    let msg =
        `[${"=".repeat(filled)}${".".repeat(empty)}] ` +
        `${(percentage * 100).toFixed(0)}% | ` +
        `Fetched ${processed} of ${total} products | `;

    if (totalCreated != null) {
        msg += `Created: ${totalCreated} | `;
    }
    if (totalExpired != null) {
        msg += `Expired: ${totalExpired} | `;
    }

    msg +=
        `Errors: ${totalErrors} | ` +
        `Elapsed: ${formatDuration(elapsed)} | Remaining: ${formatDuration(remaining)} `;

    return msg;
}

// ── Rate-limit / error handling ────────────────────────────────────────────────

async function handleFetchError(response, productId, stats) {
    customLog(`Could not fetch price of product ${productId}. Error: ${response.error}`);
    stats.failCount++;
    stats.totalErrors++;

    if (response.statusCode === 429) {
        customLog("Rate limited (429). Attempting to re-connect VPN");
        await reconnectToVpn(getRandomVpnCountry(), 20000);
    }
}

// ── Phase 1: Discover & create new products ────────────────────────────────────

async function createNewProducts(stats) {
    const newProducts = await VmpClient.GetNewProductList();
    const newProductIds = newProducts.map((p) => p.Id);

    if (newProductIds.length === 0) return true;

    customLog(`Checking if ${newProductIds.length} products not in db`, true);
    const idsNotFound = await FirebaseClient.GetIdsNotInDb(newProductIds);

    if (idsNotFound.length === 0) return true;

    customLog(`${idsNotFound.length} new products found. Creating them in database`, true);

    stats.failCount = 0;
    const startTime = Date.now();

    for (const [index, id] of idsNotFound.entries()) {
        const statusMessage = buildProgressMessage({
            processed: index + 1,
            total: idsNotFound.length,
            totalCreated: stats.totalCreated,
            totalErrors: stats.totalErrors,
            startTime,
        });
        process.stdout.write(`\r${statusMessage}`);

        try {
            const response = await VmpClient.GetProductDetailsWithStock(id, true);

            if (response.product) {
                await FirebaseClient.UpsertProduct(response.product);
                stats.totalCreated++;
                stats.failCount = 0;
            } else if (response.error) {
                await handleFetchError(response, id, stats);
            }

            if (stats.failCount > MAX_CONSECUTIVE_FAILURES) {
                customLog(`${stats.failCount} products failed in a row. Aborting.`, true);
                return false;
            }

            await randomSleep(0, 1500);
        } catch (e) {
            customLog(e, true);
            return false;
        }
    }
    return true;
}

// ── Phase 2: Update existing product prices ────────────────────────────────────

async function updateExistingProducts(stats) {
    customLog("Starting Product price fetch", true);

    const products = await FirebaseClient.GetProductsToBeUpdated();
    const batches = chunk(products, BATCH_SIZE);

    stats.failCount = 0;
    const startTime = Date.now();
    let statusMessage = "";

    for (const batch of batches) {
        await reconnectToVpn(getRandomVpnCountry(), Math.random() * 15000 + 5000);

        const dbBatch = firebase.firestore().batch();

        for (const [batchIndex, product] of batch.entries()) {
            console.clear();

            const processed = products.indexOf(product) + 1;
            statusMessage = buildProgressMessage({
                processed,
                total: products.length,
                totalExpired: stats.totalExpired,
                totalErrors: stats.totalErrors,
                startTime,
            });
            process.stdout.write(`\r${statusMessage}`);

            try {
                const detailsRes = await VmpClient.GetProductDetailsWithStock(product.Id, false);

                if (detailsRes.product) {
                    const found = await FirebaseClient.UpdateProduct(dbBatch, product, detailsRes.product);
                    if (!found) {
                        customLog(`Could not update Product ${product.Id}`);
                    }
                    stats.failCount = 0;
                } else if (detailsRes.error) {
                    await handleFetchError(detailsRes, product.Id, stats);
                } else {
                    customLog(`Product ${product.Id} was not found. Marking as 'Expired'`);
                    stats.totalExpired++;
                    await FirebaseClient.ExpireProduct(dbBatch, product.Id);
                    stats.failCount = 0;
                }

                if (stats.failCount > MAX_CONSECUTIVE_FAILURES) {
                    await NotificationClient.SendFetchErrorEmail(statusMessage, stats);
                    customLog(`${stats.failCount} products failed in a row. Aborting.`, true);
                    return;
                }

                await randomSleep(400, 1200);
            } catch (e) {
                customLog(`Pricefetch failed. Error: ${e}`, true);
            }
        }

        await dbBatch.commit();
        customLog(statusMessage, true);
    }

    customLog(statusMessage);
}

// ── Main update pipeline ───────────────────────────────────────────────────────

async function updatePrices() {
    const stats = {failCount: 0, totalErrors: 0, totalExpired: 0, totalCreated: 0};

    const success = await createNewProducts(stats);
    if (success === false) return;

    await updateExistingProducts(stats);

    await NotificationClient.SendCompletionEmail(stats);
}

// ── Scheduler / orchestrator ───────────────────────────────────────────────────

async function orchestrator() {
    let lastRunDate = -1;

    while (true) {
        const now = new Date();
        const runHour = process.argv.length > 2 ? Number(process.argv[2]) : now.getHours();

        const nextRunTime = new Date();
        nextRunTime.setHours(runHour, 0, 0, 0);

        if (now.getHours() > runHour || lastRunDate === nextRunTime.getDate()) {
            nextRunTime.setDate(nextRunTime.getDate() + 1);
        }

        const msLeft = Math.abs(nextRunTime.getTime() - now.getTime());

        if (now.getHours() === runHour && lastRunDate !== now.getDate()) {
            lastRunDate = now.getDate();
            logFile = fs.createWriteStream(getLogFilePath(), {flags: "w"});

            customLog(`Current time: ${new Date().toLocaleString()}`);
            await reconnectToVpn(getRandomVpnCountry(), 60000);
            await updatePrices();

            customLog(
                `Finished run. It took ${formatDuration(Date.now() - now)} hours.`,
                true
            );

            reconnectToVpn("Norway", 0);
        } else {
            process.stdout.write(
                `Not yet.. Sleeping for ${formatDuration(nextRunTime - now)}\n`
            );
            await sleep(msLeft);
        }
    }
}

orchestrator();
