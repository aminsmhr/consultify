import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import "./VideoCall.scss";
import { getServerUrl } from "../../lib/serverUrl";

const VideoCall = ({ serverUrlProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const isEndingCallRef = useRef(false);
  const peerConnection = useRef(
    new RTCPeerConnection({
      iceServers: [
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
      ],
    })
  );

  const { token, appointmentId, type: userType } = location.state || {};
  const serverUrl = import.meta.env.VITE_SERVER_URL || serverUrlProp || getServerUrl();

  const [socket, setSocket] = useState(null);
  const [remoteSocket, setRemoteSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError, setMediaError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const hasRemoteStream = Boolean(remoteStream);

  useEffect(() => {
    let remoteSocketId = null;
    const newSocket = io(serverUrl);
    socketRef.current = newSocket;
    setSocket(newSocket);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaError("Camera and microphone are unavailable in this browser or context.");
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          localStreamRef.current = stream;
          setLocalStream(stream);
          stream.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, stream);
          });
        })
        .catch((error) => {
          console.error(error);
          setMediaError("Unable to access camera and microphone.");
        });
    }

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        newSocket.emit("candidate", {
          offerCandidates: event.candidate,
          socketId: remoteSocketId,
        });
      }
    };

    peerConnection.current.addEventListener("connectionstatechange", () => {
      switch (peerConnection.current.connectionState) {
        case "failed":
        case "closed":
        case "disconnected":
          endCall();
          break;
        default:
          break;
      }
    });

    peerConnection.current.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    newSocket.on("offer", async ({ offer, _socket }) => {
      remoteSocketId = _socket;
      if (!peerConnection.current.currentRemoteDescription) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
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
            setRemoteSocket(response.data.peerSocket);
          }
        })
        .catch((error) => {
          console.error("Error updating socket ID: ", error?.response?.data);
        });
    });

    newSocket.on("answer", async ({ answer, socketId }) => {
      remoteSocketId = socketId;
      if (!peerConnection.current.currentRemoteDescription) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    newSocket.on("candidate", async (candidate) => {
      if (candidate) {
        try {
          await peerConnection.current.addIceCandidate(candidate);
        } catch (error) {
          console.error("Error adding received ice candidate", error);
        }
      }
    });

    return () => {
      cleanupCall(false);
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, hasRemoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, hasRemoteStream]);

  const fetchAppointment = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.get(
        `${serverUrl}/api/appointments/${appointmentId}`,
        config
      );
      const peerSocket =
        userType === "service"
          ? response.data.clientSocketId
          : response.data.consultantSocketId;
      setRemoteSocket(peerSocket);
      return peerSocket;
    } catch (error) {
      console.error("Failed to fetch appointment:", error);
      return null;
    }
  };

  const startCall = async () => {
    const socketId = remoteSocket || (await fetchAppointment());
    if (!socketId || !socket) {
      return;
    }

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", { offer, socketId });
  };

  function cleanupCall(shouldNavigate = true) {
    if (isEndingCallRef.current) {
      return;
    }

    isEndingCallRef.current = true;

    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.close();
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

    setRemoteStream(null);
    setLocalStream(null);
    setSocket(null);
    setRemoteSocket(null);
    setIsMuted(false);

    if (shouldNavigate) {
      navigate("/dashboard");
    }
  }

  function endCall() {
    cleanupCall(true);
  }

  function toggleMute() {
    if (!localStreamRef.current) {
      return;
    }

    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }

  return (
    <div className="facetime-container">
      {mediaError ? <p>{mediaError}</p> : null}
      {!hasRemoteStream ? (
        <div className="facetime-container__lobby">
          <div className="facetime-container__lobby-copy">
            <span className="facetime-container__eyebrow">Ready to join</span>
            <h1>Preview your camera before you enter the appointment.</h1>
            <p>
              Your audio and video are on standby. When you are ready, pick up to start the session.
            </p>
          </div>
        </div>
      ) : null}
      <video
        className={`video-style ${hasRemoteStream ? "video-style--remote" : "video-style--local"}`}
        ref={hasRemoteStream ? remoteVideoRef : localVideoRef}
        autoPlay
        playsInline
        muted={!hasRemoteStream}
      ></video>
      <video
        className={`local-video-style ${hasRemoteStream ? "local-video-style--visible" : "local-video-style--hidden"}`}
        ref={hasRemoteStream ? localVideoRef : remoteVideoRef}
        autoPlay
        playsInline
        muted
      ></video>
      <div className="buttons-style">
        {!hasRemoteStream && localStream != null ? (
          <button className="call-button" onClick={startCall}>
            Pick up
          </button>
        ) : null}
        {localStream != null ? (
          <button
            className={`mute-button ${isMuted ? "mute-button--muted" : ""}`}
            onClick={toggleMute}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        ) : null}
        {localStream != null ? (
          <button className="end-button" onClick={endCall}>
            Hang up
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default VideoCall;
