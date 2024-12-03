const firebaseAdminCert = require("../../../../js/functions/configs/serviceAccountKey.json");
const admin = require('firebase-admin');
import { Firestore, getFirestore } from "firebase-admin/firestore";
import FireStoreProduct from "./FireStoreProduct";
import { group } from "console";

const app = admin.initializeApp({
    credential: admin.credential.cert(firebaseAdminCert),
    databaseURL: "https://spritjakt.firebaseio.com"
 });

 const db = getFirestore(app);

 const run = async () => {

    var vintages = await db.collection("Products")
    .where("IsVintage", "==", true)
    .get();
    
    var grouped = vintages.docs.reduce((grouped, vintage) => {
        const product = vintage.data() as FireStoreProduct;

        const [productId, vintageYear] = product.Id.split('x'); // Split ID into product ID and year
        if (!grouped[productId]) {
          grouped[productId] = [];
        }

        grouped[productId].push(product); // Add vintage year to the product group
        return grouped;
      
    }, {} as Record<string, FireStoreProduct[]>);

    for (const productId in grouped) {
        
        var vintagesInGroup  = grouped[productId]; 
        for (const vintage of vintagesInGroup) {
            const res = await db.collection("Vintages").doc(productId).collection("Vintages").doc(vintage.Id).set(vintage);
            console.log(res);
        }
    }
 }

 const removeVintages = async () => {
    db.collection("Products")
    .where("IsVintage", "==", true)
    .get()
    .then((query) =>
    { 
        var docs = query.docs;
        for (const p of docs) {
            console.log(p.id);
            db.collection("Products").doc(p.id).delete();
        }
    }
    )


 }

 removeVintages();