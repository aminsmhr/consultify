import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import "./VideoCall.scss";
import { getServerUrl } from "../../lib/serverUrl";

const iceServers = [
  { urls: "stun:stun.relay.metered.ca:80" },
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
];

const VideoCall = ({ serverUrlProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, appointmentId, type: userType } = location.state || {};
  const serverUrl = import.meta.env.VITE_SERVER_URL || serverUrlProp || getServerUrl();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(new RTCPeerConnection({ iceServers }));
  const remoteSocketIdRef = useRef(null);
  const isEndingCallRef = useRef(false);

  const [remoteSocket, setRemoteSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStage, setCallStage] = useState("loading");
  const [mediaError, setMediaError] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const peerConnection = peerConnectionRef.current;
    const newSocket = io(serverUrl, token ? { auth: { token } } : undefined);

    socketRef.current = newSocket;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaError("Camera and microphone are unavailable in this browser or context.");
      setCallStage("error");
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localStreamRef.current = stream;
          setLocalStream(stream);
          setCallStage("ready");

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
          });
        })
        .catch((error) => {
          console.error(error);
          setMediaError("Unable to access camera and microphone.");
          setCallStage("error");
        });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && remoteSocketIdRef.current) {
        newSocket.emit("candidate", {
          offerCandidates: event.candidate,
          socketId: remoteSocketIdRef.current,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case "connected":
          setCallStage("connected");
          break;
        case "disconnected":
        case "closed":
        case "failed":
          endCall();
          break;
        default:
          break;
      }
    };

    peerConnection.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    newSocket.on("offer", async ({ offer, _socket }) => {
      remoteSocketIdRef.current = _socket;
      setCallStage("joining");

      if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        newSocket.emit("answer", { answer, socketId: _socket });
      }
    });

    newSocket.on("me", (socketId) => {
      const updateUrl = `${serverUrl}/api/appointments/${appointmentId}/socket`;
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const body =
        userType === "client"
          ? { clientSocketId: socketId }
          : { consultantSocketId: socketId };

      axios
        .patch(updateUrl, body, config)
        .then((response) => {
          if (response.data.peerSocket) {
            remoteSocketIdRef.current = response.data.peerSocket;
            setRemoteSocket(response.data.peerSocket);
          }
        })
        .catch((error) => {
          console.error("Error updating socket ID:", error?.response?.data);
        });
    });

    newSocket.on("answer", async ({ answer, socketId }) => {
      remoteSocketIdRef.current = socketId;
      if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    newSocket.on("candidate", async (candidate) => {
      if (!candidate) {
        return;
      }

      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Error adding received ice candidate", error);
      }
    });

    return () => {
      cleanupCall(false);
    };
  }, [appointmentId, serverUrl, token, userType]);

  const fetchAppointment = async () => {
    try {
      const response = await axios.get(`${serverUrl}/api/appointments/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const peerSocketId =
        userType === "service"
          ? response.data.clientSocketId
          : response.data.consultantSocketId;
      remoteSocketIdRef.current = peerSocketId;
      setRemoteSocket(peerSocketId);
      return peerSocketId;
    } catch (error) {
      console.error("Failed to fetch appointment:", error);
      return null;
    }
  };

  const startCall = async () => {
    setCallStage("joining");
    const peerSocketId = remoteSocket || (await fetchAppointment());

    if (!peerSocketId || !socketRef.current) {
      setCallStage("ready");
      return;
    }

    const peerConnection = peerConnectionRef.current;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socketRef.current.emit("offer", { offer, socketId: peerSocketId });
  };

  const toggleMute = () => {
    if (!localStreamRef.current) {
      return;
    }

    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  function cleanupCall(shouldNavigate = true) {
    if (isEndingCallRef.current) {
      return;
    }

    isEndingCallRef.current = true;

    const peerConnection = peerConnectionRef.current;
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    remoteSocketIdRef.current = null;
    setRemoteStream(null);
    setLocalStream(null);
    setRemoteSocket(null);
    setIsMuted(false);
    setCallStage("ended");

    if (shouldNavigate) {
      navigate("/dashboard");
    }
  }

  function endCall() {
    cleanupCall(true);
  }

  return (
    <div className="facetime-container">
      {mediaError ? <p>{mediaError}</p> : null}
      <video className="video-style" ref={remoteVideoRef} autoPlay playsInline />
      <video className="local-video-style" ref={localVideoRef} autoPlay playsInline muted />
      <div className="buttons-style">
        {callStage === "ready" ? (
          <button className="call-button" onClick={startCall}>
            Pick Up
          </button>
        ) : null}
        {callStage === "joining" ? (
          <button className="call-button" type="button" disabled>
            Connecting...
          </button>
        ) : null}
        {(callStage === "joining" || callStage === "connected") && localStream ? (
          <button className="mute-button" onClick={toggleMute}>
            {isMuted ? "Unmute" : "Mute"}
          </button>
        ) : null}
        {(callStage === "joining" || callStage === "connected") && localStream ? (
          <button className="end-button" onClick={endCall}>
            Hang Up
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default VideoCall;
