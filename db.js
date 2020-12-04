#!/usr/bin/env node
const socketIO = require('socket.io-client');

const argv = require('yargs').argv; // Analyse des paramètres

const PORT = argv.port || 3000; // Utilisation du port en paramètre ou par defaut 3000


const Server = require('socket.io');
const io = new Server(PORT, { // Création du serveur
    path: '/byr',
    serveClient: false,
});


const db = Object.create(null); // Création de la DB

console.info(`Serveur lancé sur le port ${PORT}.`);
var others_ports = [];
var peers = [];

function newPeer(port) {
    const ns = socketIO(`http://localhost:${port}`, {
        path: '/byr',
        reconnection: false,
        reconnect: false,
    });
    console.info(`connecting to http://localhost:${port}`)
    ns.on('connect', () => {
        console.log(`peer ${port} connected`)
    })
    ns.port = port
    ns.on('disconnect', function () {
        peers = peers.filter((peer) => peer.port !== port);
        others_ports = others_ports.filter((p) => p !== port);
        console.warn(`Peer ${port} disconnected`);
    })
    return ns;
}

function initialSync() {
    peers.forEach((peer) => { // récupère les clés des autres serveurs
        peer.emit('keys', (keys) => {
            keys.forEach((key) => {
                peer.emit('get', key, (value, timestamp) => {
                    db[key] = {
                        value: value,
                        timestamp: timestamp
                    };
                })
            })
        })
    })
}

function extractHorodatage() {
    return Object.keys(db).reduce(function (result, key) {
        result[key] = {
            timestamp: db[key].timestamp
        };
        return result;
    }, {});
}

io.on('connect', (socket) => { // Pour chaque nouvlle connexion
    //console.info('Nouvelle connexion');

    socket.on('get', function (field, callback) {
        console.info(`get ${field}: ${db[field]['value']} (${db[field]['timestamp']})`);
        callback(db[field]['value'], db[field]['timestamp']);
    });

    socket.on('set', function (field, value, timestamp, callback) {
        if (field in db) {
            if (db[field]['timestamp'] > timestamp) {
                db[field]['value'] = value;
            }
            console.info(`set error : Field ${field} exists.`);
            callback(false);
        } else {
            console.info(`set ${field} : ${value}`);
            db[field] = {
                value: value,
                timestamp: timestamp,
            };
            peers.forEach((peer) => peer.emit('set', field, value, timestamp, (ok) => {
                console.info(`${field} set on ${peer.port}`)
            }))
            callback(true);
        }
    });

    socket.on('keys', function (callback) {
        console.info('keys:', Object.keys(db));
        callback(Object.keys(db));
    });
    socket.on('addPeer', function (port, callback) {
        console.info('addPeer')
        if (others_ports.includes(port)) {
            callback(false)
            console.warn(`peer ${port} is already connected`)
        } else {
            others_ports.push(port)

            peers.forEach((peer) => {
                // partage à nos pairs du nouveau
                peer.emit('addPeer', port, (ok) => {
                    if (ok) {
                        console.info(`shared peer ${port}`)
                    }
                });
            })
            const newpeer = newPeer(port);
            peers.push(newpeer);
            newpeer.emit('addPeer', PORT, (ok) => {
                console.info('2-way peer')
            });
            initialSync();
            callback(true)
        }
    })

    socket.on('KeysAndTime', function (callback) {
        callback(extractHorodatage());
    })

    socket.on('peers', function (callback) {
        callback(peers.map((peer) => peer.port));
    })

    socket.on('keys2', function (ttl, callback) {
        console.info("keys:", Object.keys(db));
        if (ttl > 0) {
            peers.forEach((peer) => {
                peer.emit('keys2', (ttl - 1), function (ok) {
                });
            })
        }
        callback(true);
    })

});

setInterval(() => {
    peers.forEach((peer) => {
        peer.emit('KeysAndTime', (KeysAndTime) => {
            Object.keys(KeysAndTime).forEach((key) => {
                if (KeysAndTime[key] < db[key]) {
                    console.warn(`dates différentes pour ${key}`)
                }
            })
        })
    })
//    console.info('check fini')
}, 10000)


/*function peerExchange() {
    peers.forEach((peer) => {
        peer.emit('peers', (remote_peers) => {
            remote_peers.forEach((port) => {
                if (!others_ports.includes(port) && port != PORT) {
                    // si on découvre un nouveau pair
                    others_ports.push(port)
                    const newpeer = newPeer(port);
                    peers.push(newpeer);
                }
            })
        })
    })
}
setInterval(peerExchange, 5);*/

