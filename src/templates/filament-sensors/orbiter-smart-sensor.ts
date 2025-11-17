import { ToolheadGenerator } from '@/server/helpers/config-generation/toolhead';

export const template = (toolhead: ToolheadGenerator<boolean>) => `
[filament_switch_sensor filament_sensor${toolhead.printerHasMultipleToolheads ? `_${toolhead.getShortToolName()}` : ''}]
pause_on_runout: False
event_delay: 1.0
switch_pin: ^${toolhead.getPinFromAlias('filament_sensor_sense_pin')}
runout_gcode:
	_ON_TOOLHEAD_FILAMENT_SENSOR_RUNOUT TOOLHEAD=${toolhead.getTool()}}
insert_gcode:
	_ON_TOOLHEAD_FILAMENT_SENSOR_INSERT TOOLHEAD=${toolhead.getTool()}
  
[gcode_button filament_sensor_button${toolhead.printerHasMultipleToolheads ? `_${toolhead.getShortToolName()}` : ''}]
pin: ^${toolhead.getPinFromAlias('filament_sensor_button_pin')}
press_gcode:
    {% if (printer.print_stats.state == "printing") %}
        _ON_TOOLHEAD_FILAMENT_SENSOR_CLOG TOOLHEAD=${toolhead.getTool()}
    {% else %}
        _ON_FILAMENT_SENSOR_BUTTON_PRESSED TOOLHEAD=${toolhead.getTool()}
    {% endif %}
release_gcode:
`;
