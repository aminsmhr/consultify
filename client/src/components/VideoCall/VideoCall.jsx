import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import './VideoCall.scss';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const VideoCall = ({ serverUrlProp }) => {
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [remoteSocket, setRemoteSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState(false);
  const peerConnection = useRef(new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "502ddfd9c85733ea9cfe7daf",
        credential: "YYrBo4FYRCvy32DQ",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "502ddfd9c85733ea9cfe7daf",
        credential: "YYrBo4FYRCvy32DQ",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "502ddfd9c85733ea9cfe7daf",
        credential: "YYrBo4FYRCvy32DQ",
      },
      {
        urls: "turn:standard.relay.metered.ca:443?transport=tcp",
        username: "502ddfd9c85733ea9cfe7daf",
        credential: "YYrBo4FYRCvy32DQ",
      },
    ],
  }));

  const location = useLocation();
  const { token, appointmentId, type: userType } = location.state || {}; 
  const serverUrl = import.meta.env.VITE_SERVER_URL || serverUrlProp;


  useEffect(() => {
    let remoteSocketId = null;
    let candidates =[];
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    /* const iceServers = (async () => {const response =  await fetch("https://amin.metered.live/api/v1/turn/credentials?apiKey=c1a6e573176dc6e913665a630406ea24b038");
     return await response.json();})().then(x=>console.log("iceServers", x));
     */
    

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideoRef.current.srcObject = stream;
       setLocalStream(stream);
        stream.getTracks().forEach(track => {
          peerConnection.current.addTrack(track, stream);
        });
      })
      .catch(console.error);

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate);
        newSocket.emit("candidate", {offerCandidates : event.candidate, socketId: remoteSocketId});
      }
    };

    peerConnection.current.addEventListener(
      "connectionstatechange",
      (event) => {
        switch (peerConnection.current.connectionState) {
          case "new":
          case "connecting":
            break;
          case "connected":
            break;
          case "disconnected":
          case "closed":
          case "failed":
            endCall();
            break;
          default:
            break;
        }
      },
      false,
    );

    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onaddstream = (event) => {
    };

    newSocket.on("offer", async ({offer, _socket}) => {
      remoteSocketId = _socket;
      if (!peerConnection.current.currentRemoteDescription) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        newSocket.emit("answer", {answer, socketId: _socket});
      }
    });
    
    newSocket.on("me", (socketId) => {
      const updateUrl = `${serverUrl}/api/appointments/${appointmentId}/socket`;
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,  
        }
      };
      const body = userType === 'client' ? { clientSocketId: socketId } : { consultantSocketId: socketId };
      axios.patch(updateUrl, body, config)
        .then(async response => {
          if (response.data.peerSocket) {
            setRemoteSocket(response.data.peerSocket);
          }
        })
        .catch(error => {
          console.error("Error updating socket ID: ", error?.response?.data);
        });
    });

    newSocket.on("answer", async ({answer, socketId}) => {
      remoteSocketId = socketId;
      if (!peerConnection.current.currentRemoteDescription) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    newSocket.on("candidate", async (candidate) => {
      if (candidate) {
        try {
          await peerConnection.current.addIceCandidate(candidate);
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    return () => {
       newSocket.close();
       endCall();
    };
  }, []);

  const startCall = async () => {
    fetchAppointment();
    if (!remoteSocket) return;
    var userInput = remoteSocket;
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", {offer, socketId: userInput});
  };

  const fetchAppointment = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.get(
        `${serverUrl}/api/appointments/${appointmentId}`,
        config
      );
      setRemoteSocket(userType == 'service' ? response.data.clientSocketId : response.data.consultantSocketId);

    } catch (err) {
      console.error("Failed to fetch appointment:", err);
    }
  };

  function endCall() {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    if (socket) {
      socket.disconnect();
    }

    setRemoteStream(null);
    navigate('/dashboard');
  };

  return (
    <div className="facetime-container">
    <video className='video-style' ref={remoteVideoRef} autoPlay playsInline></video>
    <video className='local-video-style' ref={localVideoRef} autoPlay playsInline muted></video>
    <div className='buttons-style'>
      { (remoteStream == null && localStream != null) ? (<button className="call-button" onClick={startCall}>📞</button>) : ''}
      { (remoteStream != null) ? (<button className="end-button" onClick={endCall}>📞</button>) : ''}
    </div>
  </div>
  );
};

export default VideoCall;
