import { io } from 'socket.io-client';

const socket = io(`http://${window.location.hostname}:4000`, {
  withCredentials: true,
  autoConnect: true
});

export default socket;
