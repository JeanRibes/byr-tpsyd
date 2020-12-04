#!/usr/bin/env node

const argv = require('yargs') // Analyse des paramètres
    .command('get <key>', 'Récupère la valeur associé à la clé')
    .command('set <key> <value>', 'Place une association clé / valeur')
    .command('addPeer <port>', 'Ajoute un paur')
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
    console.info('Connection établie');

    switch (argv._[0]) {
        case 'get':
            socket.emit('get', argv.key, (value) => {
                console.info(`get ${argv.key} : ${value}`);
                socket.close();
            });
            break;
        case 'set':
            socket.emit('set', argv.key, argv.value, (ok) => {
                console.info(`set ${argv.key} : ${ok}`);
                socket.close();
            });
            break;
        case 'keys':
            socket.emit('keys', (res) => {
                console.info(res);
                socket.close();
            })
            break;
        case 'addPeer':
            socket.emit('addPeer', argv.port, (ok) => {
                socket.close()
            })
            break;
        default:
            console.error("Commande inconnue");
            socket.close();
    }
});
