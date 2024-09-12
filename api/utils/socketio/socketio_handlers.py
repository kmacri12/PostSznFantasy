from flask_socketio import SocketIO, emit


def setup_socketio_handlers(socketio: SocketIO):
    @socketio.on('connect')
    def handle_connect():
        print("Client connected")
        emit('response', {'data': 'Welcome!'})

    @socketio.on('message')
    def handle_message(message):
        print('Received message:', message)
        emit('response', {'data': 'Message received'})

    @socketio.on('disconnect')
    def handle_disconnect():
        print("Client disconnected")
