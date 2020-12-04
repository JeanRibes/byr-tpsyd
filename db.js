#!/usr/bin/env node
const socketIO = require('socket.io-client');

const argv = require('yargs').argv; // Analyse des paramètres
const crypto = require('crypto');

// Retourne l'empreinte de data.
const getHash = function getHash(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}
const PORT = argv.port || 3000; // Utilisation du port en paramètre ou par defaut 3000
const URL = argv.url || `http://localhost:${PORT}`

const Server = require('socket.io');
const io = new Server(PORT, { // Création du serveur
    path: '/byr',
    serveClient: false,
});


const db = Object.create(null); // Création de la DB

console.info(`Serveur lancé sur ${URL}.`);
var others_url = [];
var peers = [];

function newPeer(url) {
    const ns = socketIO(url, {
        path: '/byr',
        reconnection: false,
        reconnect: false,
    });
    console.info(`connecting to ${url}`)
    ns.on('connect', () => {
        console.log(`peer ${url} connected`)
    })
    ns.url = url
    ns.on('disconnect', function () {
        peers = peers.filter((peer) => peer.url !== url);
        others_url = others_url.filter((p) => p !== url);
        console.warn(`Peer ${url} disconnected`);
    })
    return ns;
}

function initialSync() {
    peers.forEach((peer) => { // récupère les clés des autres serveurs
        peer.emit('keys', (keys) => {
            keys.forEach((key) => {
                peer.emit('get', key, (value, timestamp, hash) => {
                    if (getHash(value) === hash) {
                        db[key] = {
                            value: value,
                            timestamp: timestamp
                        };
                    }

                })
            })
        })
    })
}

function extractHorodatage() {
    return Object.keys(db).reduce(function (result, key) {
        result[key] = {
            timestamp: db[key].timestamp,
            hash: db[key].hash,
        };
        return result;
    }, {});
}

io.on('connect', (socket) => { // Pour chaque nouvlle connexion
    //console.info('Nouvelle connexion');

    socket.on('get', function (field, callback) {
        console.info(`get ${field}: ${db[field]['value']} (${db[field]['timestamp']})`);
        callback(db[field].value, db[field].timestamp);
    });

    socket.on('set', function (field, value, timestamp, hash, callback) {
        if (field in db) {
            if (db[field].timestamp > timestamp) {
                db[field].value = value;
                db[field].hash = hash;
            }
            console.info(`set error : Field ${field} exists.`);
            callback(false);
        } else {
            console.info(`set ${field} : ${value}`);
            db[field] = {
                value: value,
                timestamp: timestamp,
                hash: hash,
            };
            peers.forEach((peer) => peer.emit('set', field, value, timestamp, hash, (ok) => {
                console.info(`${field} set on ${peer.port}`)
            }))
            callback(true);
        }
    });

    socket.on('keys', function (callback) {
        console.info('keys:', Object.keys(db));
        callback(Object.keys(db));
    });
    socket.on('addPeer', function (url, callback) {
        console.info('addPeer')
        if (others_url.includes(url)) {
            callback(false)
            console.warn(`peer ${url} is already connected`)
        } else {
            others_url.push(url)

            peers.forEach((peer) => {
                // partage à nos pairs du nouveau
                peer.emit('addPeer', url, (ok) => {
                    if (ok) {
                        console.info(`shared peer ${url}`)
                    }
                });
            })
            const newpeer = newPeer(url);
            peers.push(newpeer);
            newpeer.emit('addPeer', URL, (ok) => {
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
        callback(peers.map((peer) => peer.url));
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
                    console.warn(`dates différentes pour ${key}, MaJ`)
                    peer.emit('get', key, (value, timestamp, hash) => {
                        if (hash === getHash(value)) {
                            db[key] = value;
                        }
                    })
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
                if (!others_url.includes(port) && port != PORT) {
                    // si on découvre un nouveau pair
                    others_url.push(port)
                    const newpeer = newPeer(port);
                    peers.push(newpeer);
                }
            })
        })
    })
}
setInterval(peerExchange, 5);*/

