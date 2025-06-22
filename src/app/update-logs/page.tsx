import { UpdateLogsViewer } from '@/components/update-logs/update-logs-viewer';
import { UpdateLogsErrorBoundary } from '@/components/update-logs/update-logs-error-boundary';

export default function UpdateLogsPage() {
	return (
		<UpdateLogsErrorBoundary>
			<UpdateLogsViewer />
		</UpdateLogsErrorBoundary>
	);
}
