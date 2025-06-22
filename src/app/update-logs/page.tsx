import { UpdateLogsViewer } from '@/components/update-logs/update-logs-viewer';
import { UpdateLogsErrorBoundary } from '@/components/update-logs/update-logs-error-boundary';

export default function UpdateLogsPage() {
	return (
		<div className="container mx-auto py-6">
			<div className="mb-6">
				<h1 className="text-3xl font-bold">Update Logs</h1>
				<p className="mt-2 text-muted-foreground">
					View and analyze logs from RatOS update scripts to troubleshoot issues and monitor system updates.
				</p>
			</div>
			<UpdateLogsErrorBoundary>
				<UpdateLogsViewer />
			</UpdateLogsErrorBoundary>
		</div>
	);
}
