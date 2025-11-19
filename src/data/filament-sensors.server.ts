import { z } from 'zod';
import { FilamentSensor } from '@/zods/hardware';
import type { PartialPrinterConfiguration } from '@/zods/printer-configuration';
import { parseDirectory } from '@/server/routers/printer';
import { parseBoardPinConfig } from '@/server/helpers/metadata';
import { PartialToolheadConfiguration } from '@/zods/toolhead';

/**
 * Return valid filament sensor options considering the controlboard and/or toolhead configuration.
 *
 * @param config A partial printer configuration or null. Only a subset is used:
 *               - `controlboard` — the selected control board (used to resolve pins)
 *               - `toolheads` — an array of toolheads (used when toolNumber is supplied)
 *
 * @param toolNumber Optional toolhead index to select the toolhead from the printer config.
 *                   If not provided, toolheadConfig must be provided.
 *
 * @param toolheadConfig Optional partial toolhead configuration to use directly. Only a subset is used:
 * 					- `toolboard` — the selected toolboard (used to resolve pins)
 * 					- `toolNumber` — the tool number (used for badge purposes), can also be provided via toolNumber param.
 *					Note:
 *                    You must provide either toolNumber or toolheadConfig to identify the toolhead.
 *                    You must also provide { controlboard } in config if you want to consider controlboard pins.
 *
 * Typical callers:
 *  - Pass a printer config and tool number; or
 *  - Pass a printer config and toolheadConfig; or
 *  - Pass a minimal { controlboard } config and toolheadConfig.
 */
export const filamentSensorOptions = async (
	config?: PartialPrinterConfiguration | null,
	toolNumber?: number | null,
	toolheadConfig?: PartialToolheadConfiguration | null,
): Promise<z.infer<typeof FilamentSensor>[]> => {
	// For a potentially non-empty result, caller must supply either:
	// - A toolhead index to select the toolhead from the printer config
	// - A toolhead config directly
	// We need:
	// - The toolhead number for badge purposes
	// - The board pin configuration for the controlboard or toolboard
	if (toolNumber != null && toolheadConfig?.toolNumber != null && toolheadConfig.toolNumber !== toolNumber) {
		throw new Error('toolNumber and toolheadConfig.toolNumber do not match.');
	}
	toolNumber ??= toolheadConfig?.toolNumber;
	if (
		toolheadConfig == null &&
		toolNumber != null &&
		config?.toolheads != null &&
		config.toolheads.length > toolNumber
	) {
		toolheadConfig = config.toolheads[toolNumber];
	}
	const toolboard = toolheadConfig?.toolboard;
	const controlboard = config?.controlboard;
	const hasToolboard = toolboard != null;
	const hasControlboard = controlboard != null;

	if (!hasToolboard && !hasControlboard) {
		return [];
	}

	const boardPins = hasToolboard ? await parseBoardPinConfig(toolboard) : await parseBoardPinConfig(controlboard!);
	const allSensors: z.infer<typeof FilamentSensor>[] = await parseDirectory('filament-sensors', FilamentSensor);

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
							children: `${toolboard.name} T${toolNumber}`,
						}
					: {
							color: 'purple',
							children: controlboard!.name,
						},
			];
			return sensorCopy;
		});

	return sensors;
};
