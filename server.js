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
const Instruments = [{ name: 'Test', pairName: "Test", Exchange: "Test", Value: false, MDReqID: '0' },{ name: 'SIDUS', pairName: "SIDUS-USDT", Exchange: "KUCOIN", Value: false, MDReqID: '0' }]


const fixServer = new FIXServer();

const SENDER = 'CLIENT';
const TARGET = 'WDTP';
let Auth = false;
try {
    fixServer.createServer({
        host: '0.0.0.0',
        port: '31000',
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
            Auth = false;
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
        return;
    }

    else if (refined['35'] === Messages.MarketDataRequest && Auth) {
        Instruments.forEach(element => {
            if (element.name === refined['55'] && element.Value === false && (refined['263'] === '1')) {
                element.Value = true;
                element.MDReqID = refined['262'];
            }
            else if (element.name === refined['55'] && element.Value === true && refined['263'] === '2') {
                element.Value = false;
                element.MDReqID = '0';
            }
        });
    }
    else if (refined['35'] === Messages.TestRequest) {


    }
}


function authClient(msg) {
    if (msg['554'] == process.env.SECRET_KEY) {
        Auth = true;
    }
    else {
        const logon = fixServer.createMessage(
            new Field(Fields.MsgType, Messages.Logout),
            new Field(Fields.SenderCompID, TARGET),
            new Field(Fields.TargetCompID, SENDER),
            new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
            new Field(Fields.SendingTime, fixServer.getTimestamp()),
            new Field(Fields.Text, 'Wrong Password'),
        );
        fixServer.send(logon);
    }
}





async function engine() {

    const promises = Instruments.map(async element => {
        if (element.Value === true) {
            if (element.Exchange === 'Test') {
                let newPriceFeed = { symbol: element.name, price: 0.00, MDReqID: element.MDReqID }
                const feeds = fixServer.createMessage(
                    new Field(Fields.MsgType, Messages.MarketDataSnapshotFullRefresh),
                    new Field(Fields.SenderCompID, TARGET),
                    new Field(Fields.TargetCompID, SENDER),
                    new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
                    new Field(Fields.SendingTime, fixServer.getTimestamp()),
                    new Field(Fields.Symbol, newPriceFeed.symbol),
                    new Field(Fields.MDReqID, newPriceFeed.MDReqID),
                    new Field(Fields.NoMDEntries, '2'),
                    new Field(Fields.MDEntryType, '0'),
                    new Field(Fields.MDEntryPx, newPriceFeed.price),
                    new Field(Fields.MDEntrySize, '1000000000'),
                    new Field(Fields.QuoteEntryID, '0'),
                    new Field(Fields.MDEntryType, '1'),
                    new Field(Fields.MDEntryPx, newPriceFeed.price),
                    new Field(Fields.MDEntrySize, '1000000000'),
                    new Field(Fields.QuoteEntryID, '1'),
                );
                fixServer.send(feeds);
            }


            else if (element.Exchange === 'KUCOIN') {
                let price = await getKucoinTokenPrice(element.pairName);
                let newPriceFeed = { symbol: element.name, price: price, MDReqID: element.MDReqID }

                const feeds = fixServer.createMessage(
                    new Field(Fields.MsgType, Messages.MarketDataSnapshotFullRefresh),
                    new Field(Fields.SenderCompID, TARGET),
                    new Field(Fields.TargetCompID, SENDER),
                    new Field(Fields.MsgSeqNum, fixServer.getNextTargetMsgSeqNum()),
                    new Field(Fields.SendingTime, fixServer.getTimestamp()),
                    new Field(Fields.Symbol, newPriceFeed.symbol),
                    new Field(Fields.MDReqID, newPriceFeed.MDReqID),
                    new Field(Fields.NoMDEntries, '2'),
                    new Field(Fields.MDEntryType, '0'),
                    new Field(Fields.MDEntryPx, newPriceFeed.price),
                    new Field(Fields.MDEntrySize, '1000000000'),
                    new Field(Fields.QuoteEntryID, '0'),
                    new Field(Fields.MDEntryType, '1'),
                    new Field(Fields.MDEntryPx, newPriceFeed.price),
                    new Field(Fields.MDEntrySize, '1000000000'),
                    new Field(Fields.QuoteEntryID, '1'),
                );
                fixServer.send(feeds);
            }
        }
    });
}


setInterval(engine, 2000);






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
    console.log('Unhandled Promise Rejection:', reason);
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


