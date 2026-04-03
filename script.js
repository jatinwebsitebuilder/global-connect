const socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');

let localStream;
let peerConnection;
let currentRoom;

// Google's free public servers to help connect devices across the internet
const configuration = {
    'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]
};

// 1. Turn on the user's camera immediately
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch(error => console.error("Camera access denied!", error));

// 2. Click "Next" to find a match
nextBtn.addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
    socket.emit('find-match');
});

// 3. Server found a match! Set up the video connection.
socket.on('match-start', async (data) => {
    currentRoom = data.room;
    peerConnection = new RTCPeerConnection(configuration);

    // Add our camera to the connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // When we receive their camera data, show it
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Send connection data to the other person
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('signal', { room: currentRoom, signal: { type: 'candidate', candidate: event.candidate } });
        }
    };

    // If we are the initiator, make the first phone call (Offer)
    if (data.initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { room: currentRoom, signal: { type: 'offer', offer: offer } });
    }
});

// 4. Handle incoming video connection data
socket.on('signal', async (data) => {
    if (data.signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { room: currentRoom, signal: { type: 'answer', answer: answer } });
    } else if (data.signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } else if (data.signal.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

// 5. If they skip us, clear their video
socket.on('peer-disconnected', () => {
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
});
