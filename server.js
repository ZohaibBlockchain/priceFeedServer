import e from 'express';
import {
    FIXServer,
    Field,
    Fields,
    Messages,
    EncryptMethod,
} from 'free-fx/FIXServer';
import { getKucoinTokenPrice } from "./w3.js";
import dotenv from 'dotenv';
dotenv.config();




const requiredFields = ['Username', 'MsgType', 'EncryptMethod', 'Password', 'Symbol', 'HeartBtInt', 'MsgSeqNum'];


const Instruments = [{ name: 'Deliverable.SIDUS', pairName: "SIDUS-USDT", Exchange: "KUCOIN", Value: false }]


const fixServer = new FIXServer();

const SENDER = 'CLIENT';
const TARGET = 'WDTP';

try {
    fixServer.createServer({
        host: '0.0.0.0',
        port: 31000,
        protocol: 'tcp',
        sender: TARGET,
        target: SENDER,
        fixVersion: 'FIX.4.4',
        onReady: () => { ready() },
        onOpen: () => { console.log('Opened') },
        onMessage: (message) => { msg(message) },
        onError: (error) => { console.log(error) },
        onClose: () => { 
            Instruments.forEach(element => {
              element.Value = false;
            });
         },
    });
} catch (error) {
    console.error('TCP Connection Error:', error);
}




function ready() {
    console.log('Server Ready');
}

function msg(_msg) {

    const msg = _msg.encode('|');
    const refined = parseFixMessage(msg);
    if (refined['35'] === Messages.Logon) {
        authClient(refined);
    }
    else if (refined['35'] === Messages.MarketDataRequest) {
        Instruments.forEach(element => {
            if (element.name === refined['55'] && element.Value === false) {
                element.Value = true;
                const MDR = fixServer.createMessage(
                    new Field(Fields.MsgType, Messages.MarketDataRequest),
                    new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
                    new Field(Fields.RawData, ('Subscribed to: ' + refined['55'])),
                    new Field(Fields.TargetCompID, SENDER),
                );
                fixServer.send(MDR);
            }
        });
        console.log(Instruments);
    }
}


function authClient(msg) {
    console.log(msg['554'])
    if (msg['554'] == process.env.SECRET_KEY) {
        const logon = fixServer.createMessage(
            new Field(Fields.MsgType, Messages.Logon),
            new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
            new Field(Fields.RawData, 'Succefull Logon'),
            new Field(Fields.TargetCompID, SENDER),
        );
        fixServer.send(logon);
    }
    else {
        const logon = fixServer.createMessage(
            new Field(Fields.MsgType, Messages.Logout),
            new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
            new Field(Fields.RawData, 'Wrong Password'),
            new Field(Fields.TargetCompID, SENDER),
        );
        fixServer.send(logon);
    }
}






function extractRequiredFields(message) {
    const extractedFields = {};

    for (const field of message.data) {
        if (requiredFields.includes(field.name)) {
            extractedFields[field.name] = field.value;
        }
    }

    return extractedFields;
}


process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});


function parseFixMessage(fixMessage) {
    const fields = fixMessage.split('|');
    const result = {};

    fields.forEach(field => {
        const [tag, value] = field.split('=');
        result[tag] = value;
    });

    return result;
}


async function engine() {
    let compileObject = [];

    // Map Instruments to an array of promises
    const promises = Instruments.map(async element => {
        if (element.Value === true) {
            if (element.Exchange === 'KUCOIN') {
                let price = await getKucoinTokenPrice(element.pairName);
                let newPriceFeed = { symbol: element.name, price: price }
                compileObject.push(newPriceFeed);
                console.log(element.pairName, ' Price: ', price);
            }
        }
    });

    // Wait for all promises to complete
    await Promise.all(promises);

    // After all promises are completed, check if compileObject has data and send it
    if (compileObject.length > 0) {
        const feeds = fixServer.createMessage(
            new Field(Fields.MsgType, Messages.MassQuote),
            new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
            new Field(Fields.RawData,JSON.stringify(compileObject)),
            new Field(Fields.TargetCompID, SENDER),
        );
        fixServer.send(feeds);
    }
}


setInterval(engine, 2500);

