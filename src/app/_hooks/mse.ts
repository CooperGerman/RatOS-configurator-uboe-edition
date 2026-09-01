import { useEffect, useRef, useState } from 'react';

export function useMSE(
	url: string,
	enabled: boolean,
	onStreamStats?: (stats: RTCInboundRtpStreamStats) => void,
) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed' | null>(null);

	useEffect(() => {
		if (!enabled || !videoRef.current) return;
		const video = videoRef.current;
		const mediaSource = new MediaSource();
		const mediaSourceUrl = URL.createObjectURL(mediaSource);
		const socket = new WebSocket(url);
		let sourceBuffer: SourceBuffer | null = null;
		let pendingMimeType: string | null = null;
		let queue: ArrayBuffer[] = [];
		let mediaSourceOpen = false;
		let frameCount = 0;
		let lastFrameCount = 0;
		let lastFrameTime = performance.now();
		let frameRequest: number | null = null;

		const createSourceBuffer = () => {
			if (!mediaSourceOpen || sourceBuffer || pendingMimeType == null) return;
			sourceBuffer = mediaSource.addSourceBuffer(pendingMimeType);
			sourceBuffer.addEventListener('updateend', appendNext);
			setConnectionState('connected');
			appendNext();
		};

		const appendNext = () => {
			if (mediaSourceOpen && sourceBuffer && !sourceBuffer.updating && queue.length > 0) {
				sourceBuffer.appendBuffer(queue.shift() as ArrayBuffer);
			}
		};

		const onMessage = (event: MessageEvent<string | ArrayBuffer>) => {
			if (typeof event.data === 'string') {
				const message = JSON.parse(event.data) as { type: string; value?: string };
				if (message.type === 'mse' && message.value) {
					pendingMimeType = message.value;
					createSourceBuffer();
				}
				return;
			}
			const data = event.data instanceof ArrayBuffer ? event.data : event.data;
			queue.push(data);
			appendNext();
		};

		const onOpen = () => {
			setConnectionState('connecting');
			socket.send(JSON.stringify({ type: 'mse' }));
		};
		const onError = () => setConnectionState('failed');
		const onSourceOpen = () => {
			mediaSourceOpen = true;
			createSourceBuffer();
			video.play().catch(() => undefined);
		};
		const onVideoFrame = (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
			frameCount += 1;
			const elapsed = performance.now() - lastFrameTime;
			if (elapsed >= 1000) {
				onStreamStats?.({
					framesPerSecond: ((frameCount - lastFrameCount) * 1000) / elapsed,
				} as RTCInboundRtpStreamStats);
				lastFrameCount = frameCount;
				lastFrameTime = performance.now();
			}
			frameRequest = video.requestVideoFrameCallback(onVideoFrame);
		};

		video.src = mediaSourceUrl;
		frameRequest = video.requestVideoFrameCallback(onVideoFrame);
		socket.binaryType = 'arraybuffer';
		socket.addEventListener('open', onOpen);
		socket.addEventListener('message', onMessage);
		socket.addEventListener('error', onError);
		mediaSource.addEventListener('sourceopen', onSourceOpen, { once: true });

		return () => {
			if (frameRequest != null) video.cancelVideoFrameCallback(frameRequest);
			socket.close();
			mediaSourceOpen = false;
			if (sourceBuffer && mediaSource.readyState === 'open') mediaSource.removeSourceBuffer(sourceBuffer);
			video.removeAttribute('src');
			video.load();
			URL.revokeObjectURL(mediaSourceUrl);
		};
	}, [enabled, onStreamStats, url]);

	return { videoRef, connectionState };
}