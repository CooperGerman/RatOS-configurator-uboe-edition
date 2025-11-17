import { ToolheadGenerator } from '@/server/helpers/config-generation/toolhead';
import { z } from 'zod';

// The following 2 lines will go away once toolhead.getFilamentSensor() is implemented
import { FilamentSensor } from '@/zods/hardware';
type FilamentSensor = z.infer<typeof FilamentSensor>;

const TemplateProperties = z.object({
	invertSensePin: z.boolean().default(false),
	invertButtonPin: z.boolean().default(false),
	pullUpSensePin: z.boolean().default(true),
	pullUpButtonPin: z.boolean().default(true),
});

export const template = (toolhead: ToolheadGenerator<boolean>) => {
	// TODO: Awaiting toolhead.getFilamentSensor() implementation, then the explicit type can be removed.
	const sensor: FilamentSensor = toolhead.getFilamentSensor();
	const props = TemplateProperties.parse(sensor.templateProperties);
	const sense = `
[filament_switch_sensor filament_sensor${toolhead.printerHasMultipleToolheads ? `_${toolhead.getShortToolName()}` : ''}]
pause_on_runout: False
event_delay: 1.0
switch_pin: ${props.invertSensePin ? '!' : ''}${props.pullUpSensePin ? '^' : ''}${toolhead.getPinFromAlias('filament_sensor_sense_pin')}
runout_gcode:
	_ON_TOOLHEAD_FILAMENT_SENSOR_RUNOUT TOOLHEAD=${toolhead.getTool()}
insert_gcode:
	_ON_TOOLHEAD_FILAMENT_SENSOR_INSERT TOOLHEAD=${toolhead.getTool()}
`;
	if (sensor.hasButton) {
		const button = `
[gcode_button filament_sensor_button${toolhead.printerHasMultipleToolheads ? `_${toolhead.getShortToolName()}` : ''}]
pin: ${props.invertButtonPin ? '!' : ''}${props.pullUpButtonPin ? '^' : ''}${toolhead.getPinFromAlias('filament_sensor_button_pin')}
press_gcode:
	_ON_FILAMENT_SENSOR_BUTTON_PRESSED TOOLHEAD=${toolhead.getTool()}
release_gcode:
`;
		return sense + button;
	} else {
		return sense;
	}
};
