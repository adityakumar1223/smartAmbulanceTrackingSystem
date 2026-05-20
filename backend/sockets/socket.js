let io;

const initializeSocket = (serverIo) => {
    io = serverIo;
};

const getIo = () => {
    if(!io){
        throw new Error("Socket.io not initialized");
    };

    return io;
}

module.exports = {initializeSocket, getIo};