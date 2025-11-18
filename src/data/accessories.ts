import { z } from 'zod';
import { ChamberAirFilter, ChamberLighting, FilamentSensor, ToolheadAlignmentSystem } from '@/zods/hardware';
import type { PartialPrinterConfiguration } from '@/zods/printer-configuration';
import { parseDirectory } from '@/server/routers/printer';
import { parseBoardPinConfig } from '@/server/helpers/metadata';

export const filamentSensorOptions = async (
	config?: PartialPrinterConfiguration | null,
	toolheadIndex?: number | null,
): Promise<z.infer<typeof FilamentSensor>[]> => {
	const allSensors: z.infer<typeof FilamentSensor>[] = await parseDirectory('filament-sensors', FilamentSensor);

	if (config?.toolheads != null) {
		const toolheadConfig = toolheadIndex != null ? config.toolheads[toolheadIndex] : null;
		if (toolheadConfig != null && (toolheadConfig.toolboard != null || config.controlboard != null)) {
			const toolNumberSuffix = toolheadConfig?.toolNumber != null ? ` T${toolheadConfig.toolNumber}` : '';
			const hasToolboard = toolheadConfig.toolboard != null;
			const boardPins = hasToolboard
				? await parseBoardPinConfig(toolheadConfig.toolboard!)
				: await parseBoardPinConfig(config.controlboard!);

			// Only include sensors for which all required pins are present
			const sensors = allSensors
				.filter((sensor) => {
					const requiredPins = sensor.additionalRequiredPins ?? [];
					requiredPins.push(sensor.sensePinAlias);
					if (sensor.hasButton) {
						requiredPins.push(sensor.buttonPinAlias);
					}
					return requiredPins.every((pin: string) => (boardPins as Record<string, unknown>)[pin] != null);
				})
				.map((sensor) => {
					const sensorCopy = { ...sensor };
					sensorCopy.badge = [
						hasToolboard
							? {
									color: 'sky',
									children: `${toolheadConfig.toolboard!.name}${toolNumberSuffix}`,
								}
							: {
									color: 'purple',
									children: config!.controlboard!.name,
								},
					];
					return sensorCopy;
				});

			return sensors;
		}
	}
	return [];
};

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

export const toolheadAlignmentSystemOptions = (
	config?: PartialPrinterConfiguration | null,
): z.infer<typeof ToolheadAlignmentSystem>[] => {
	const options: z.infer<typeof ToolheadAlignmentSystem>[] = [
		{
			id: 'ratRigVaoc' as const,
			title: 'Rat Rig VAOC',
			badge: [{ color: 'purple', children: config?.controlboard?.name ?? 'Control Board' }],
		},
		{
			id: 'none' as const,
			title: 'None',
		},
	];
	return options;
};

export const defaultToolheadAlignmentSystem = {
	id: 'none' as const,
	title: 'None',
};

export const chamberAirFilterOptions = (
	config?: PartialPrinterConfiguration | null,
): z.infer<typeof ChamberAirFilter>[] => {
	const options: z.infer<typeof ChamberAirFilter>[] = [
		{
			id: 'ratRigRatPack' as const,
			title: 'Rat Rig Rat Pack',
			badge: [{ color: 'purple', children: config?.controlboard?.name ?? 'Control Board' }],
		},
		{
			id: 'none' as const,
			title: 'None',
		},
	];
	return options;
};

export const defaultChamberAirFilter = {
	id: 'none' as const,
	title: 'None',
};
