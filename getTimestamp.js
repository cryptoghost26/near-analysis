const nearAPI = require("near-api-js");
const dotenv = require("dotenv");
const { Parser } = require('json2csv');
const fs = require('fs');
dotenv.config();
const DATAS = require('./nearReward.json');

const { keyStores, KeyPair, connect } = nearAPI;
const myKeyStore = new keyStores.InMemoryKeyStore();
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const keyPair = KeyPair.fromString(PRIVATE_KEY);

const initialize = async (account) => {
  try {
      // adds the keyPair you created to keyStore
      await myKeyStore.setKey("mainnet", account, keyPair);
      
      const connectionConfig = {
          networkId: "mainnet",
          keyStore: myKeyStore,
          nodeUrl: "https://archival-rpc.mainnet.near.org",
          walletUrl: "https://wallet.near.org",
          explorerUrl: "https://explorer.near.org",
      }
      
      const nearConnection = await connect(connectionConfig);
      return nearConnection;
  } catch(e){
      console.log("initialize error:", e);
  }
}

const fetchEpochBlockInfo = async (near, datas) => {
    const jsonMap = await Promise.all(datas.map(async data => {
        try {
            const epochBlock = await near.connection.provider.block({blockId:parseInt(data.blockHeight)});
            return {
                epoch: data.epoch,
                timeStamp : new Date(epochBlock.header.timestamp/(1000*1000)).toISOString()
            }
        }catch (e){
            console.log("Error handle", e.message);
            return {
                epoch: data.epoch,
                timeStamp: data.blockHeight
            }
        }
    }));
    return jsonMap;    
}



start = async (ready) => {
    let accountId = `${process.env.ACCOUNT}.near`
    console.log("1. initialize ===");
    const near = await initialize(accountId);
    if (ready){
        try {
          let table = await fetchEpochBlockInfo(near, DATAS);

          const json2csvParser = new Parser();
          const csv = json2csvParser.parse(table);
            fs.writeFileSync(`timeStamp.csv`, csv);
            
        }
        catch(e){
            console.log("Error: ", e);
        }
    }
  };

start(true);

// epoch830 :  ~ 45719462 
// epoch831 : 45719463 ~ 45762662
// start : 45770000(QgJ6fkjN4qShNDjud5kgugKQHgNYRCCdc3YqyhwZxPd)
// epoch832 : 45762663 ~ 45805862