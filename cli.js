#!/usr/bin/env node
const crypto = require('crypto');

// Retourne l'empreinte de data.
const getHash = function getHash(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function getMagicHash(key, value) {
    //console.log('key',key,'value',value)
    let i = 0;
    let hash = "";
    while (!hash.startsWith('0')) {
        const s = `${key}${value}${i}`
        hash = getHash(s)
        //console.log(`${s} : ${hash}`)
        i+=1;
    }
    return [hash, i]
}

const argv = require('yargs') // Analyse des paramètres
    .command('get <key>', 'Récupère la valeur associé à la clé')
    .command('set <key> <value>', 'Place une association clé / valeur')
    .command('addPeer <purl>', 'Ajoute un paur')
    .command('keys', 'Demande la liste des clés')
    .option('url', {
        alias: 'u',
        default: 'http://localhost:3000',
        description: 'Url du serveur à contacter'
    })
    .demandCommand(1, 'Vous devez indiquer une commande')
    .help()
    .argv;

const io = require('socket.io-client');

const socket = io(argv.url, {
    path: '/byr',
});

socket.on('error', (error) => {
    console.error('Haaaaaaaaaaaaa !', error);
    socket.close();
});

socket.on('connect_error', (error) => {
    console.error('Hello ?', error);
    socket.close();
});

socket.on('connect_timeout', (timeout) => {
    console.error('Poueuffff !', error);
    socket.close();
});

socket.on('connect', () => {
    //console.info('Connection établie');

    switch (argv._[0]) {
        case 'get':
            socket.emit('get', argv.key, (value, _) => {
                console.info(`get ${argv.key} : ${value}`);
                socket.close();
            });
            break;
        case 'set':
            const [hash, magic_number] = getMagicHash(argv.key, argv.value);
            console.log('hash magique', hash, 'i', magic_number)
            socket.emit('set', argv.key, argv.value, (new Date()).getTime(), hash, magic_number, (ok) => {
                console.info(`set ${argv.key} : ${ok}`);
                socket.close();
            });
            break;
        case 'keys':
            socket.emit('keys2', 1, (res) => {
                console.info(res);
                socket.close();
            })
            break;
        case 'addPeer':
            socket.emit('addPeer', argv.purl, (ok) => {
                console.info('announced', argv.purl)
                socket.close()
            })
            break;
        case 'kat':
            socket.emit('KeysAndTime', (res) => {
                console.info('KeysAndTime', res);
                socket.close();
            })
            break;
        case 'peers':
            socket.emit('peers', (pl) => {
                console.info('peer list', pl);
                socket.close();
            })
            break;
        default:
            console.error("Commande inconnue");
            socket.close();
    }
});
