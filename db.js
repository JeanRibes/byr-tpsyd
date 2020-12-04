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
const ports = [3000, 3001, 3002, 3003];
const others_ports = ports.filter((port) => port !== PORT)

const peers = others_ports.map((port, _) => {
    console.info(`connecting to http://localhost:${port}`)
    const ns = socketIO(`http://localhost:${port}`, {
        path: '/byr'
    });
    ns.on('connect', () => {
        console.log(`peer ${port} connected`)
        peers.forEach((peer)=>{ // récupère les clés des autres serveurs
            peer.emit('keys',(keys)=>{
                keys.forEach((key)=>{
                    peer.emit('get',key,(value)=>{
                        db[key]=value;
                    })
                })
            })
        })
    })
    return ns
})

io.on('connect', (socket) => { // Pour chaque nouvlle connexion
    console.info('Nouvelle connexion');

    socket.on('get', function (field, callback) {
        console.info(`get ${field}: ${db[field]}`);
        callback(db[field]);
    });

    socket.on('set', function (field, value, callback) {
        if (field in db) {
            console.info(`set error : Field ${field} exists.`);
            callback(false);
        } else {
            console.info(`set ${field} : ${value}`);
            db[field] = value;
            peers.forEach((peer) => peer.emit('set', field, value, (ok) => {
                console.info(`${field} set on ${peer.port}`)
            }))
            callback(true);
        }
    });

    socket.on('keys', function (callback) {
        console.info('keys:', Object.keys(db));
        callback(Object.keys(db));
    });
    socket.on('addPeer',function (port,callback) {
        const newPeer = socketIO(`http://localhost:${port}`, {
            path: '/byr'
        });
        newPeer.on('connect', function (){
            console.log(`peer ${port} connected`)
        })
        peers.push(newPeer);
    })
});
