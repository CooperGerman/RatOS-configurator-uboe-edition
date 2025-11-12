import path from 'path';
import { serverSchema } from '@/env/schema.mjs';
import { replaceOrAddIniSectionsFromFileSync } from '@/server/helpers/file-operations';

export function getUpdatedCrowsnestConfForRatRigVaoc() {
	const environment = serverSchema.parse(process.env);
	const crowsnestPath = path.join(environment.KLIPPER_CONFIG_PATH, 'crowsnest.conf');
	return replaceOrAddIniSectionsFromFileSync(crowsnestPath, [
		{
			section: 'crowsnest',
			body: `log_path: /home/pi/printer_data/logs/crowsnest.log
log_level: verbose
delete_log: false
no_proxy: false
`,
		},
		{
			section: 'cam 1',
			body: `# Required for Rat Rig VAOC camera integration, DO NOT MODIFY THIS SECTION.
mode: camera-streamer
enable_rtsp: false
rtsp_port: 8554
port: 8080
device: /dev/video0
resolution: 1920x1080
max_fps: 30
`,
		},
	]);
}
