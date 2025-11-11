import { z } from 'zod';
import { ChamberLighting } from '@/zods/hardware';
import type { PartialPrinterConfiguration } from '@/zods/printer-configuration';

export const chamberLightingOptions = (
	config?: PartialPrinterConfiguration | null,
): z.infer<typeof ChamberLighting>[] => {
	const options: z.infer<typeof ChamberLighting>[] = [
		{
			id: 'controlboard' as const,
			title: 'Wired to Controlboard',
			badge: [{ color: 'purple', children: config?.controlboard?.name ?? 'Control Board' }],
		},
		{
			id: 'none' as const,
			title: 'None',
		},
	];
	return options;
};

export const defaultChamberLighting = {
	id: 'none' as const,
	title: 'None',
};
