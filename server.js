import {
    FIXServer,
    Field,
    Fields,
    Messages,
    EncryptMethod,
} from 'free-fx/FIXServer';

const requiredFields = ['Username', 'MsgType', 'EncryptMethod', 'Password', 'Symbol', 'HeartBtInt', 'MsgSeqNum'];

const fixServer = new FIXServer();



try {
    fixServer.createServer({
        host: 'localhost',
        port: 31000,
        protocol: 'tcp',
        sender: 'WDTP',
        target: 'CLIENT',
        fixVersion: 'FIX.4.4',
        onReady: () => { ready() },
        onOpen: () => { console.log('Opened') },
        onMessage: (message) => { msg(message) },
        onError: (error) => { console.log(error) },
        onClose: () => { console.log('closed') },
    });
} catch (error) {
    console.error('TCP Connection Error:', error);
}

  


function ready() {
    console.log('Server Ready');
}

function msg(msg) {
    const extractedFields = extractRequiredFields(msg);
    console.log(extractedFields);
    if (extractedFields.MsgType === Messages.Logon) {
        authClient(extractedFields);
    }
    else if (extractedFields.MsgType === Messages.Logon) {
        console.log(extractedFields);
    }
}


function authClient(msg) {
    if (msg.Password === '1234') {
        console.log('Checked');
    }
    else {
        const logon = fixServer.createMessage(
            new Field(Fields.MsgType, Messages.Logout),
            new Field(Fields.RefSeqNum, msg.MsgSeqNum),
            new Field(Fields.SessionRejectReason, 'Failed to Authenticate'),
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