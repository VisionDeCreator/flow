// Dependence
import 'dotenv/config';

// Node imports
import fs from 'node:fs';

// Packages imports
import { Transaction } from '@mysten/sui/transactions';
import inquirer from 'inquirer';

// Local imports
import config from "../../../config.json" assert { type: "json" };
import { getClient, getKeypair, mistToSui } from "../../utils/suiUtils.js";
import { getCoolerFactoryId, getPacakgeId, getWaterCoolerDetails, delay } from "../../utils/waterCooler.js";
import { getObjectIdJson } from "../../utils/getObjectIdJson.js";
import { updateNestedConfig } from "../../utils/configUtils.js";
import { getCoolerPrice } from "../helpers/getCoolerPrice.js";
import { 
  WATER_COOLER, WATER_COOLER_ID, WATER_COOLER_ADMIN, WATER_COOLER_ADMIN_ID,
  REGISTRY, REGISTRY_ID, REGISTRY_ADMIN, REGISTRY_ADMIN_CAP_ID,
  MINT_SETTINGS, MINT_SETTING_ID, MINT_WAREHOUSE, MINT_WAREHOUSE_ID, MINT_ADMIN, MINT_ADMIN_CAP_ID,
  COLLECTION, COLLECTION_ID,
  DIGEST, DIGEST_BUY
 } from "../../constants.js";


// Buy a Water Cooler from the Factory in the Water Cooler Protocol
export default async () => {
  const price = await getCoolerPrice();

  const prompt = inquirer.createPromptModule();
  const answers = await prompt([
    {
      type: "input",
      name: "confirm",
      message: `You are about to buy a Water Cooler for ${mistToSui(price)} $SUI. To confirm type y or n to cancel:`
    }
  ]);

  // Execute buy order to protocol
  if(answers.confirm == "y") {
    console.log(`Ordering Water Cooler now.`);

    const CoolerDetails = await getWaterCoolerDetails();

    console.log("Shipping... Your Water Cooler will arrive soon");

    const { name, description, supply, treasury, image_url } = CoolerDetails;

    const keypair = getKeypair();
    const client = getClient();
  
    const packageId = getPacakgeId();
    const tx = new Transaction();

    tx.setGasBudget(config.gasBudgetAmount);

    const [coin] = tx.splitCoins(tx.gas, [price]);

    const coolerFactoryId = getCoolerFactoryId();

    tx.moveCall({
      target: `${packageId}::cooler_factory::buy_water_cooler`,
      arguments: [
        tx.object(coolerFactoryId), coin,
        tx.pure.string(name), tx.pure.string(description),
        tx.pure.string(image_url), tx.pure.u64(supply),
        tx.pure.address(treasury)
      ]
    });
  
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
    });

    // Wait for the transaction to be finalised
    await delay(3000); // Wait 5 seconds

    const objectChange = await client.getTransactionBlock({
      digest: result?.digest,
      // only fetch the effects field
      options: {
        showEffects: false,
        showInput: false,
        showEvents: false,
        showObjectChanges: true,
        showBalanceChanges: false,
      },
    });

    await updateNestedConfig(DIGEST, DIGEST_BUY, result?.digest);

    // console.log("result?.digest", result?.digest);
    
    const water_cooler_id = await getObjectIdJson(WATER_COOLER, objectChange);
    const water_cooler_admin_cap_id = await getObjectIdJson(WATER_COOLER_ADMIN, objectChange);
    const registry_id = await getObjectIdJson(REGISTRY, objectChange);
    const registry_admin_cap_id = await getObjectIdJson(REGISTRY_ADMIN, objectChange);
    const mint_setting_id = await getObjectIdJson(MINT_SETTINGS, objectChange);
    const mint_warehouse_id = await getObjectIdJson(MINT_WAREHOUSE, objectChange);
    const mint_admin_id = await getObjectIdJson(MINT_ADMIN, objectChange);
    const collection_id = await getObjectIdJson(COLLECTION, objectChange);

    // console.log("water_cooler_id", water_cooler_id);
    // console.log("water_cooler_admin_cap_id", water_cooler_admin_cap_id);
    // console.log("registry_id", registry_id);
    // console.log("registry_admin_cap_id", registry_admin_cap_id);
    // console.log("mint_setting_id", mint_setting_id);
    // console.log("mint_warehouse_id", mint_warehouse_id);
    // console.log("mint_admin_id", mint_admin_id);
    // console.log("collection_id", collection_id);

    await updateNestedConfig(config.network, WATER_COOLER_ID, water_cooler_id);
    await updateNestedConfig(config.network, WATER_COOLER_ADMIN_ID, water_cooler_admin_cap_id);
    await updateNestedConfig(config.network, REGISTRY_ID, registry_id);
    await updateNestedConfig(config.network, REGISTRY_ADMIN_CAP_ID, registry_admin_cap_id);
    await updateNestedConfig(config.network, MINT_SETTING_ID, mint_setting_id);
    await updateNestedConfig(config.network, MINT_WAREHOUSE_ID, mint_warehouse_id);
    await updateNestedConfig(config.network, MINT_ADMIN_CAP_ID, mint_admin_id);
    await updateNestedConfig(config.network, COLLECTION_ID, collection_id);


    const folderName = '.outputs';

    try {
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
    } catch (err) {
      console.error(err);
    }
  
    const writeStream = fs.createWriteStream(".outputs/water_cooler.json", { flags: 'w' });
      writeStream.write(JSON.stringify(objectChange, null, 4));
      writeStream.end();
  
    console.log("Your Water Cooler has arrived.");

  } else {
    console.log(`Buy order canceled.`);
  }
}
