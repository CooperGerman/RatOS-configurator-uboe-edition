import { useEffect, useRef, useState } from 'react';

export function useMSE(url: string, enabled: boolean, onStreamStats?: (stats: RTCInboundRtpStreamStats) => void) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed' | null>(null);

	useEffect(() => {
		if (!enabled || !videoRef.current) return;
		if (!('MediaSource' in window)) {
			setConnectionState('failed');
			return;
		}

		const video = videoRef.current;
		const mediaSource = new MediaSource();
		const mediaSourceUrl = URL.createObjectURL(mediaSource);
		const socket = new WebSocket(url);
		const buffer = new Uint8Array(2 * 1024 * 1024);
		let bufferLength = 0;
		let sourceBuffer: SourceBuffer | null = null;
		let pendingMimeType: string | null = null;
		let mediaSourceOpen = false;
		let stopped = false;
		let startupTimer: number | null = null;
		let trimTimer: number | null = null;
		let frameRequest: number | null = null;
		let frameCount = 0;
		let lastFrameCount = 0;
		let lastFrameTime = performance.now();

		const fail = () => {
			if (!stopped) setConnectionState('failed');
		};

		const trimBuffer = () => {
			if (!sourceBuffer || sourceBuffer.updating || !video.buffered.length || mediaSource.readyState !== 'open') return;
			const end = video.buffered.end(video.buffered.length - 1);
			const start = end - 5;
			const start0 = video.buffered.start(0);
			try {
				if (start > start0) sourceBuffer.remove(start0, start);
				mediaSource.setLiveSeekableRange(start, end);
				if (video.currentTime < start) video.currentTime = start;
			} catch {
				fail();
			}
		};

		const appendBuffer = () => {
			if (!sourceBuffer || sourceBuffer.updating || bufferLength === 0) return;
			try {
				sourceBuffer.appendBuffer(buffer.slice(0, bufferLength));
				bufferLength = 0;
			} catch (error) {
				if (!(error instanceof DOMException && error.name === 'QuotaExceededError')) fail();
			}
		};

		const onSourceBufferUpdate = () => {
			appendBuffer();
			if (sourceBuffer && !sourceBuffer.updating && video.buffered.length) {
				const end = video.buffered.end(video.buffered.length - 1);
				const gap = end - video.currentTime;
				video.playbackRate = Math.max(Math.min(gap, 1.25), 0.1);
			}
			trimBuffer();
		};

		const createSourceBuffer = () => {
			if (!mediaSourceOpen || sourceBuffer || pendingMimeType == null) return;
			try {
				sourceBuffer = mediaSource.addSourceBuffer(pendingMimeType);
				sourceBuffer.mode = 'segments';
				sourceBuffer.addEventListener('updateend', onSourceBufferUpdate);
				sourceBuffer.addEventListener('error', fail);
				if (startupTimer != null) window.clearTimeout(startupTimer);
				setConnectionState('connected');
				appendBuffer();
			} catch {
				fail();
			}
		};

		const onMessage = (event: MessageEvent<string | ArrayBuffer | Blob>) => {
			if (typeof event.data === 'string') {
				const message = JSON.parse(event.data) as { type: string; value?: string };
				if (message.type !== 'mse' || !message.value || sourceBuffer) return;
				pendingMimeType = message.value;
				createSourceBuffer();
				return;
			}

			const appendData = (data: ArrayBuffer) => {
				if (stopped) return;
				const bytes = new Uint8Array(data);
				if (bufferLength + bytes.byteLength > buffer.byteLength) {
					trimBuffer();
					if (bufferLength + bytes.byteLength > buffer.byteLength) {
						fail();
						return;
					}
				}
				buffer.set(bytes, bufferLength);
				bufferLength += bytes.byteLength;
				appendBuffer();
			};

			if (event.data instanceof ArrayBuffer) appendData(event.data);
			else if (event.data instanceof Blob) event.data.arrayBuffer().then(appendData).catch(fail);
		};

		const onOpen = () => {
			setConnectionState('connecting');
			const codecs = [
				'avc1.640029',
				'avc1.64002A',
				'avc1.640033',
				'hvc1.1.6.L153.B0',
				'mp4a.40.2',
				'mp4a.40.5',
				'flac',
				'opus',
			].filter((codec) => MediaSource.isTypeSupported(`video/mp4; codecs="${codec}"`));
			socket.send(JSON.stringify({ type: 'mse', value: codecs.join(',') }));
		};

		const onSourceOpen = () => {
			mediaSourceOpen = true;
			createSourceBuffer();
			video.play().catch(() => undefined);
		};
		const onVideoFrame = (now: DOMHighResTimeStamp) => {
			frameCount += 1;
			const elapsed = now - lastFrameTime;
			if (elapsed >= 1000) {
				onStreamStats?.({ framesPerSecond: ((frameCount - lastFrameCount) * 1000) / elapsed } as RTCInboundRtpStreamStats);
				lastFrameCount = frameCount;
				lastFrameTime = now;
			}
			if (video.requestVideoFrameCallback) frameRequest = video.requestVideoFrameCallback(onVideoFrame);
		};

		video.src = mediaSourceUrl;
		video.load();
		if (video.requestVideoFrameCallback) frameRequest = video.requestVideoFrameCallback(onVideoFrame);
		socket.binaryType = 'arraybuffer';
		socket.addEventListener('open', onOpen);
		socket.addEventListener('message', onMessage);
		socket.addEventListener('error', fail);
		socket.addEventListener('close', fail);
		mediaSource.addEventListener('sourceopen', onSourceOpen, { once: true });
		mediaSource.addEventListener('error', fail);
		startupTimer = window.setTimeout(fail, 10000);
		trimTimer = window.setInterval(trimBuffer, 500);

		return () => {
			stopped = true;
			if (startupTimer != null) window.clearTimeout(startupTimer);
			if (trimTimer != null) window.clearInterval(trimTimer);
			if (frameRequest != null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameRequest);
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
