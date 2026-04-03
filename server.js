const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(__dirname))//This is the new line line!
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Different "Waiting Rooms" for different categories
let queues = {
    female: [], male: [], couple: [], trans: [], gay: [], kink: []
};

io.on('connection', (socket) => {
    console.log('A global user connected:', socket.id);

    // WHEN A USER CLICKS "START MATCHING"
    socket.on('find-match', (data) => {
        const { identity, interest, isPremium } = data;

        // 1. LOOK FOR A PARTNER: Find someone who wants my type and I want theirs
        let matchIndex = queues[interest].findIndex(user => user.interest === identity);

        if (matchIndex !== -1) {
            // FOUND A MATCH!
            const match = queues[interest][matchIndex];
            const roomName = 'room-' + socket.id;

            socket.join(roomName);
            match.socket.join(roomName);

            // Tell both browsers to start the video and chat
            io.to(roomName).emit('matched', {
                partnerType: interest,
                room: roomName
            });

            // Remove the partner from the queue since they are now busy
            queues[interest].splice(matchIndex, 1);
            console.log(`Successfully matched ${identity} with ${interest}`);
        } else {
            // NO MATCH YET: Put this user in the queue
            const userData = { id: socket.id, socket: socket, interest: interest };

            if (isPremium) {
                // PRO PERK: Premium users jump to the front of the line
                queues[identity].unshift(userData);
            } else {
                queues[identity].push(userData);
            }
            console.log(`${identity} is now waiting for a ${interest}...`);
        }
    });

    // TEXT CHAT: Relay messages between the two matched users
    socket.on('send-chat', (msg) => {
        const rooms = Array.from(socket.rooms);
        const chatRoom = rooms.find(r => r.startsWith('room-'));
        if (chatRoom) {
            socket.to(chatRoom).emit('receive-chat', msg);
        }
    });

    // DISCONNECT: Remove them from all waiting rooms if they close the tab
    socket.on('disconnect', () => {
        for (let key in queues) {
            queues[key] = queues[key].filter(user => user.id !== socket.id);
        }
        console.log('User left the site:', socket.id);
    });
});

// START THE SERVER
const PORT = process.env.port || 3000;
server.listen(PORT, () => {
    console.log('-------------------------------------------');
    console.log(`🚀 GLOBAL SERVER IS ALIVE ON PORT ${PORT}`);
    console.log('-------------------------------------------');
});
