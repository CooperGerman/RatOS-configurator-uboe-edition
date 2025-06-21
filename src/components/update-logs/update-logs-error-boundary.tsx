'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Card } from '@/components/common/card';
import { Button } from '@/components/common/button';
import { ErrorMessage } from '@/components/common/error-message';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { getLogger } from '@/app/_helpers/logger';

interface UpdateLogsErrorFallbackProps {
	error: Error;
	resetErrorBoundary: () => void;
}

const UpdateLogsErrorFallback: React.FC<UpdateLogsErrorFallbackProps> = ({ 
	error, 
	resetErrorBoundary 
}) => {
	const handleDownloadDebugInfo = () => {
		window.location.href = '/configure/api/debug-zip';
	};

	return (
		<Card className="p-6">
			<div className="text-center space-y-4">
				<AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
				<div>
					<h2 className="text-xl font-semibold text-red-700 mb-2">
						Update Logs Error
					</h2>
					<ErrorMessage title="Failed to load update logs">
						{error.message}
					</ErrorMessage>
				</div>
				
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<Button onClick={resetErrorBoundary} className="flex items-center gap-2">
						<RefreshCw className="h-4 w-4" />
						Try Again
					</Button>
					<Button 
						variant="outline" 
						onClick={handleDownloadDebugInfo}
						className="flex items-center gap-2"
					>
						<Download className="h-4 w-4" />
						Download Debug Info
					</Button>
				</div>
				
				<div className="text-sm text-gray-600 max-w-md mx-auto">
					<p>
						If this error persists, please download the debug information and share it 
						on the RatOS support channel for assistance.
					</p>
				</div>
			</div>
		</Card>
	);
};

interface UpdateLogsErrorBoundaryProps {
	children: React.ReactNode;
}

export const UpdateLogsErrorBoundary: React.FC<UpdateLogsErrorBoundaryProps> = ({ children }) => {
	const handleError = (error: Error, errorInfo: { componentStack: string }) => {
		// Log the error for debugging
		getLogger().error('Update logs error boundary caught an error', {
			error: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
		});
	};

	return (
		<ErrorBoundary
			FallbackComponent={UpdateLogsErrorFallback}
			onError={handleError}
			onReset={() => {
				// Optionally clear any error state or refresh data
				window.location.reload();
			}}
		>
			{children}
		</ErrorBoundary>
	);
};
