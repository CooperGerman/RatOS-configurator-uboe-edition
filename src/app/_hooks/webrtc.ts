import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogger } from '@/app/_helpers/logger';

interface WebRTCConfig {
	iceServers?: RTCIceServer[];
	sdpSemantics: 'unified-plan';
}

// !TODO: add logic to switch beetwen camera-streamer logic and go2rtc logic
export function useWebRTC(
	url: string,
	onStreamStats?: (stats: RTCInboundRtpStreamStats) => void,
	enabled = true,
	contentType: 'application/json' | 'application/sdp' = 'application/json',
) {
	const videoElRef = useRef<HTMLVideoElement>(null);
	const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
	const peerConnection = useRef<RTCPeerConnection | null>(null);

	const connect = useCallback(async () => {
		if (!enabled) return;
		try {
			setConnectionState('connecting');

			const pc = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
			});

			peerConnection.current = pc;

			// Add transceivers for receiving video
			pc.addTransceiver('video', { direction: 'recvonly' });

			// Handle incoming tracks
			pc.ontrack = (event) => {
				if (videoElRef.current && event.track.kind === 'video') {
					videoElRef.current.srcObject = event.streams[0];
				}
			};

			// Handle connection state changes
			pc.onconnectionstatechange = () => {
				setConnectionState(pc.connectionState);
			};

			// Create offer
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			// Send offer to go2rtc
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': contentType },
				body: contentType === 'application/json' ? JSON.stringify({ type: 'offer', sdp: offer.sdp }) : offer.sdp,
			});

			if (!response.ok) throw new Error(`WebRTC request failed: ${response.status}`);
			const answer = contentType === 'application/json' ? await response.json() : { type: 'answer', sdp: await response.text() };
			await pc.setRemoteDescription(answer);
		} catch (error) {
			// Handle error silently or use proper error handling
			setConnectionState('failed');
		}
	}, [contentType, enabled, url]);

	// Get stream stats
	useEffect(() => {
		if (onStreamStats) {
			const interval = setInterval(async () => {
				if (peerConnection.current) {
					const stats = await peerConnection.current.getStats();
					stats.forEach((report) => {
						if (report.type === 'inbound-rtp' && report.kind === 'video') {
							const data = report as RTCInboundRtpStreamStats;
							onStreamStats?.(data);
						}
					});
				}
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [onStreamStats]);

	useEffect(() => {
		if (!enabled) return;
		connect();
		return () => peerConnection.current?.close();
	}, [connect, enabled]);

	return {
		videoRef: videoElRef,
		connectionState,
		close: useCallback(() => {
			peerConnection.current?.close();
		}, []),
	};
}
