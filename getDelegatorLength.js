const nearAPI = require("near-api-js");
const axios = require("axios");
const dotenv = require("dotenv");
const BigNumber = require('bignumber.js');
const { Parser } = require('json2csv');
const fs = require('fs');
dotenv.config();
const DATA1 = require('./nearValidator1.json');

const { keyStores, KeyPair, connect } = nearAPI;
const myKeyStore = new keyStores.InMemoryKeyStore();
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const keyPair = KeyPair.fromString(PRIVATE_KEY);

const initialize = async (account) => {
  try {
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

const fetchDelegatorInfo = async (near, datas) => {
        const table = [];
        for await (let data of datas) {
        let blockHeight = parseInt(data.blockHeight);
            try {
                console.log(`${data.blockHeight} Block Query Start`)
                console.log(`${data.account} Query Start`)
                const response = await near.connection.provider.query({
                    request_type: "call_function",
                    block_id: blockHeight,
                    account_id: data.account,
                    method_name: "get_accounts",
                    args_base64: Buffer.from('{"from_index": 0, "limit": 500}').toString('base64'),
                    gas : 3000000000000000,
                    amount: 1e24
                });
                
                const stringResponse = String.fromCharCode(...response.result);
                const delegatorLength = JSON.parse(stringResponse).length;                
                table.push({
                    ...data,
                    delegators : delegatorLength
                });                
            }catch (e){
                console.log("Error handle", e.message);
            }
    };
    let data = JSON.stringify(table, null, 2);
    fs.writeFileSync(`nearValidator.json`, data);
    return table;    
}


start = async (ready) => {
    let accountId = `${process.env.ACCOUNT}`
    console.log("1. initialize ===");
    const near = await initialize(accountId);
    if (ready){
        try {
        const datas =[
            ...DATA1,
        ];
          let table = await fetchDelegatorInfo(near, datas);
          const json2csvParser = new Parser();
          const csv = json2csvParser.parse(table);
          fs.writeFileSync(`nearValidatorAll.csv`, csv);            
        }
        catch(e){
            console.log("Error: ", e);
        }
    }
  };

start(true);