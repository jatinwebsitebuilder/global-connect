const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(__dirname)); 
const server = http.createServer(app);
const io = new Server(server);

let waitingUser = null; // The queue

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('find-match', () => {
        // If someone is waiting, and it's not the same person clicking twice
        if (waitingUser && waitingUser.id !== socket.id) {
            const roomName = 'room_' + socket.id;
            
            // Put both users in a private room
            socket.join(roomName);
            waitingUser.join(roomName);

            // Tell them they matched! The 'initiator' starts the WebRTC call
            io.to(socket.id).emit('match-start', { room: roomName, initiator: true });
            io.to(waitingUser.id).emit('match-start', { room: roomName, initiator: false });

            waitingUser = null; // Empty the queue for the next person
        } else {
            // Nobody is waiting, so this user becomes the waiting user
            waitingUser = socket;
        }
    });

    // Relay WebRTC video signals between the two matched users
    socket.on('signal', (data) => {
        socket.to(data.room).emit('signal', data);
    });

    socket.on('disconnect', () => {
        if (waitingUser === socket) waitingUser = null;
        socket.broadcast.emit('peer-disconnected');
    });
});

// Render gives us a dynamic port, or we use 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
