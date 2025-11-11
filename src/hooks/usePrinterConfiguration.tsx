'use client';

import { atom, selector, useRecoilValue, useRecoilState, waitForAll, noWait, DefaultValue } from 'recoil';
import { z } from 'zod';
import { ChamberLighting, Fan } from '@/zods/hardware';
import {
	PartialPrinterConfiguration,
	PrinterConfiguration,
	SerializedPartialPrinterConfiguration,
	SerializedPrinterConfiguration,
} from '@/zods/printer-configuration';
import { syncEffect } from 'recoil-sync';
import { getRefineCheckerForZodSchema } from 'zod-refine';
import { useMemo } from 'react';
import {
	serializePartialToolheadConfiguration,
	serializePrinterRail,
	serializeToolheadConfiguration,
} from '@/utils/serialization';
import {
	ControlboardState,
	LoadablePrinterRailsState,
	PrinterRailsState,
	PrinterSizeState,
	PrinterState,
} from '@/recoil/printer';
import { PrinterToolheadsState } from '@/recoil/toolhead';
import { defaultControllerFan } from '@/data/fans';
import { moonrakerWriteEffect } from '@/components/sync-with-moonraker';
import { getLogger } from '@/app/_helpers/logger';
import { trpcClient } from '@/helpers/trpc';
import { defaultChamberLighting } from '@/data/accessories';

export const PerformanceModeState = atom<boolean | null | undefined>({
	key: 'PerformanceMode',
	default: false,
	effects: [
		moonrakerWriteEffect(),
		syncEffect({
			refine: getRefineCheckerForZodSchema(z.boolean().optional().nullable()),
		}),
	],
});

export const ChamberLightingState = atom<z.infer<typeof ChamberLighting> | null | undefined>({
	key: 'ChamberLighting',
	default: defaultChamberLighting,
	effects: [
		moonrakerWriteEffect(),
		syncEffect({
			read: async ({ read }) => {
				const chamberLightingState = read('ChamberLighting');
				if (chamberLightingState != null && chamberLightingState !== '') {
					if (typeof chamberLightingState === 'string') {
						try {
							const chamberLightingOptions = (await import('@/data/accessories')).chamberLightingOptions;
							const options = chamberLightingOptions();
							const chamberLighting = options.find((a) => a.id === chamberLightingState);
							if (chamberLighting != null) {
								return chamberLighting;
							}
						} catch (error) {
							getLogger().error('RecoilSync: failed to deserialize chamber lighting!', error, chamberLightingState);
						}
					}
				}
				return defaultChamberLighting;
			},
			write: ({ write }, newValue) => {
				// Serialize the chamber lighting to store only the ID
				if (newValue instanceof DefaultValue || newValue == null) {
					write(ChamberLightingState.key, newValue);
					return;
				}
				write(ChamberLightingState.key, newValue.id);
			},
			refine: getRefineCheckerForZodSchema(ChamberLighting.nullable()),
		}),
	],
});

export const StealthchopState = atom<boolean | null | undefined>({
	key: 'Stealchop',
	default: false,
	effects: [
		moonrakerWriteEffect(),
		syncEffect({
			refine: getRefineCheckerForZodSchema(z.boolean().optional().nullable()),
		}),
	],
});

export const StandstillStealthState = atom<boolean | null | undefined>({
	key: 'StandstillStealth',
	default: false,
	effects: [
		moonrakerWriteEffect(),
		syncEffect({
			refine: getRefineCheckerForZodSchema(z.boolean().optional().nullable()),
		}),
	],
});
export const ControllerFanState = atom<z.infer<typeof Fan> | null>({
	key: 'ControllerFan',
	default: defaultControllerFan,
	effects: [
		moonrakerWriteEffect(),
		syncEffect({
			read: async ({ read }) => {
				const fanState = await read(ControllerFanState.key);
				if (fanState != null) {
					// If it's already a full object, return it
					const parsedFan = Fan.safeParse(fanState);
					if (parsedFan.success) {
						return parsedFan.data;
					}
					// If it's just an ID string, deserialize it via the server
					if (typeof fanState === 'string') {
						try {
							const controlboardState = await read('Controlboard');
							const controlboardId =
								typeof controlboardState === 'object' && controlboardState != null && 'id' in controlboardState
									? (controlboardState as any).id
									: null;
							const fanOptions = await trpcClient.printer.controllerFanOptions.query({
								config: { controlboard: controlboardId },
							});
							const fan = fanOptions.find((f) => f.id === fanState);
							if (fan != null) {
								return fan;
							}
						} catch (error) {
							getLogger().error('RecoilSync: failed to deserialize controller fan!', error, fanState);
						}
					}
				}
				return defaultControllerFan;
			},
			write: ({ write }, newValue) => {
				// Serialize the fan to store only the ID
				if (newValue instanceof DefaultValue || newValue == null) {
					write(ControllerFanState.key, newValue);
					return;
				}
				write(ControllerFanState.key, newValue.id);
			},
			refine: getRefineCheckerForZodSchema(Fan.nullable()),
		}),
	],
});

export const PrinterConfigurationState = selector<z.infer<typeof PartialPrinterConfiguration> | null>({
	key: 'PrinterConfiguration',
	get: async ({ get }) => {
		const {
			printer,
			printerSize,
			performanceMode,
			stealthchop,
			standstillStealth,
			chamberLighting,
			rails,
			controlboard,
			controllerFan,
			toolheads,
		} = get(
			waitForAll({
				printer: PrinterState,
				printerSize: PrinterSizeState,
				performanceMode: PerformanceModeState,
				stealthchop: StealthchopState,
				standstillStealth: StandstillStealthState,
				chamberLighting: ChamberLightingState,
				rails: PrinterRailsState,
				controlboard: ControlboardState,
				controllerFan: ControllerFanState,
				toolheads: PrinterToolheadsState,
			}),
		);

		const input = {
			printer:
				printer == null
					? null
					: {
							...printer,
							defaults: {
								...printer.defaults,
								toolheads: printer?.defaults.toolheads.map((th) => serializeToolheadConfiguration(th)),
							},
						},
			size: printerSize,
			performanceMode,
			stealthchop,
			standstillStealth,
			chamberLighting,
			rails,
			controlboard,
			controllerFan,
			toolheads: toolheads.length > 0 ? toolheads : undefined,
		} satisfies {
			[key in keyof PrinterConfiguration]: NonNullable<PartialPrinterConfiguration>[key] | null | undefined;
		};

		const printerConfig = PartialPrinterConfiguration.safeParse(input);
		if (printerConfig.success === false) {
			getLogger().error(
				{ errors: printerConfig.error.flatten().fieldErrors, data: input },
				"Couldn't parse printer configuration",
			);
		}
		return printerConfig.success ? printerConfig.data : null;
	},
});

export const LoadablePrinterConfigurationState = selector<z.infer<typeof PartialPrinterConfiguration>>({
	key: 'LoadablePrinterConfigurationState',
	get: async ({ get }) => {
		const loadable = get(noWait(PrinterConfigurationState));
		return {
			hasValue: () => loadable.contents,
			hasError: () => null,
			loading: () => null,
		}[loadable.state]();
	},
});

export const serializePrinterConfiguration = (config: PrinterConfiguration): SerializedPrinterConfiguration => {
	const serializedConfig: SerializedPrinterConfiguration = {
		printer: config.printer.id,
		toolheads: config.toolheads.map((toolhead) => serializeToolheadConfiguration(toolhead)),
		size: config.size,
		controlboard: config.controlboard.id,
		controllerFan: config.controllerFan.id,
		performanceMode: config.performanceMode,
		stealthchop: config.stealthchop,
		standstillStealth: config.standstillStealth,
		chamberLighting: config.chamberLighting.id,
		rails: config.rails.map((rail) => serializePrinterRail(rail)),
	};
	return SerializedPrinterConfiguration.parse(serializedConfig);
};
export const serializePartialPrinterConfiguration = (
	config: PartialPrinterConfiguration,
): SerializedPartialPrinterConfiguration => {
	const toolheads = config?.toolheads?.map((toolhead) => serializePartialToolheadConfiguration(toolhead));
	const serializedConfig: SerializedPartialPrinterConfiguration = {
		printer: config?.printer?.id,
		toolheads: toolheads,
		size: config?.size,
		controlboard: config?.controlboard?.id,
		controllerFan: config?.controllerFan?.id,
		performanceMode: config?.performanceMode,
		stealthchop: config?.stealthchop,
		standstillStealth: config?.standstillStealth,
		chamberLighting: config?.chamberLighting?.id,
	};
	return SerializedPartialPrinterConfiguration.parse(serializedConfig);
};

export const useSerializedPrinterConfiguration = () => {
	const printerConfiguration = useRecoilValue(PrinterConfigurationState);
	const serializedPrinterConfiguration = useMemo(
		() => serializePartialPrinterConfiguration(printerConfiguration ?? {}),
		[printerConfiguration],
	);
	return serializedPrinterConfiguration;
};
export const usePrinterConfiguration = () => {
	const [selectedPrinter, setSelectedPrinter] = useRecoilState(PrinterState);
	const [selectedPrinterOption, setSelectedPrinterOption] = useRecoilState(PrinterSizeState);
	const [selectedBoard, setSelectedBoard] = useRecoilState(ControlboardState);
	const [performanceMode, setPerformanceMode] = useRecoilState(PerformanceModeState);
	const [stealthchop, setStealthchop] = useRecoilState(StealthchopState);
	const [standstillStealth, setStandstillStealth] = useRecoilState(StandstillStealthState);
	const [chamberLighting, setChamberLighting] = useRecoilState(ChamberLightingState);
	const [selectedControllerFan, setSelectedControllerFan] = useRecoilState(ControllerFanState);
	const selectedPrinterRails = useRecoilValue(PrinterRailsState);
	const printerConfiguration = useRecoilValue(PrinterConfigurationState);
	const serializedPrinterConfiguration = useSerializedPrinterConfiguration();
	const parsedPrinterConfiguration = PrinterConfiguration.safeParse(printerConfiguration);

	return {
		selectedPrinter,
		setSelectedPrinter,
		selectedPrinterOption,
		setSelectedPrinterOption,
		selectedBoard,
		setSelectedBoard,
		performanceMode,
		setPerformanceMode,
		stealthchop,
		setStealthchop,
		standstillStealth,
		setStandstillStealth,
		chamberLighting,
		setChamberLighting,
		selectedPrinterRails,
		selectedControllerFan,
		setSelectedControllerFan,
		partialPrinterConfiguration: printerConfiguration,
		serializedPrinterConfiguration,
		parsedPrinterConfiguration,
	};
};
