// Data loader for business rules data files
const fs = require('fs').promises;
const path = require('path');
const csvParse = require('csv-parse/sync');

class DataLoader {
    constructor(dataPath) {
        this.dataPath = dataPath || path.join(__dirname, '../../data');
    }

    /**
     * Load forbidden processes from BR_Data.csv
     */
    async loadForbiddenProcesses() {
        const filePath = path.join(this.dataPath, 'BR_Data.csv');
        
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const records = csvParse.parse(fileContent, {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true
            });

            return records.map(record => ({
                rootGroupCode: record.ROOT_GROUP_CODE,
                rootGroupLabel: record.ROOT_GROUP_LABEL,
                forbiddenProcessCode: record.FORBIDDEN_PROCS,
                forbiddenProcessLabel: record.FORBIDDEN_PROCS_LABELS,
                ordinalCode: parseFloat(record.ORDINAL_CODE) || 0
            }));
        } catch (error) {
            console.error('Error loading BR_Data.csv:', error);
            return [];
        }
    }

    /**
     * Load warning messages from warningMessages.txt
     */
    async loadWarningMessages() {
        const filePath = path.join(this.dataPath, 'warningMessages.txt');
        
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const records = csvParse.parse(fileContent, {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true
            });

            const messages = {};
            records.forEach(record => {
                const messageId = `BR${String(record['Message ID']).padStart(2, '0')}`;
                messages[messageId] = {
                    id: record['Message ID'],
                    trigger: record['Trigger Event Description'],
                    text: record['Text'],
                    semaphoreSeverity: record['SemaphoreWarningLevel'],
                    textSeverity: record['TextWarningLevel'],
                    severity: record['SemaphoreWarningLevel'] // Use semaphore as main severity
                };
            });

            return messages;
        } catch (error) {
            console.error('Error loading warningMessages.txt:', error);
            return this.getDefaultWarningMessages();
        }
    }

    /**
     * Load warning colors from warningColors.txt
     */
    async loadWarningColors() {
        const filePath = path.join(this.dataPath, 'warningColors.txt');
        
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            const colors = {};
            lines.forEach(line => {
                const [severity, colorInfo] = line.split(';');
                if (severity && colorInfo) {
                    const [rgb, description] = colorInfo.split(',');
                    colors[severity.trim()] = {
                        rgb: rgb.trim(),
                        description: description ? description.trim() : ''
                    };
                }
            });

            return colors;
        } catch (error) {
            console.error('Error loading warningColors.txt:', error);
            return this.getDefaultWarningColors();
        }
    }

    /**
     * Load all data files
     */
    async loadAllData() {
        const [forbiddenProcesses, warningMessages, warningColors] = await Promise.all([
            this.loadForbiddenProcesses(),
            this.loadWarningMessages(),
            this.loadWarningColors()
        ]);

        return {
            forbiddenProcesses,
            warningMessages,
            warningColors
        };
    }

    /**
     * Get default warning messages if file not found
     */
    getDefaultWarningMessages() {
        return {
            BR01: {
                text: 'For mixed raw primary commodity terms it is only allowed to add under F27 source-commodities children of the already present implicit facet.',
                severity: 'HIGH'
            },
            BR03: {
                text: 'The F01 source facet is not allowed in composite food. Choose instead an F04 ingredient facet.',
                severity: 'HIGH'
            },
            BR04: {
                text: 'The F27 source-commodities facet is not allowed in composite food. Choose instead an F04 ingredient facet.',
                severity: 'HIGH'
            },
            BR05: {
                text: 'The F27 source-commodities facet which are not better specifing the already present implicit one are not allowed.',
                severity: 'HIGH'
            },
            BR06: {
                text: 'The F01 source facet is only allowed in derivatives with an F27 source-commodities facet implicitly present.',
                severity: 'HIGH'
            },
            BR07: {
                text: 'The F01 source facet can only be populated for derivatives having a single F27 source-commodities facet.',
                severity: 'HIGH'
            },
            BR08: {
                text: 'The use of this term is forbidden in the reporting hierarchy.',
                severity: 'HIGH'
            },
            BR10: {
                text: 'The use of non-specific terms as base term is discouraged.',
                severity: 'LOW'
            },
            BR11: {
                text: 'The use of generic terms under F28 process facet is discouraged.',
                severity: 'LOW'
            },
            BR12: {
                text: 'The F04 ingredient facet can only be used as a minor ingredient to derivative or raw primary commodity terms.',
                severity: 'LOW'
            },
            BR13: {
                text: 'The F03 physical state facet reported creates a new derivative nature and therefore cannot be applied to raw primary commodity.',
                severity: 'HIGH'
            },
            BR14: {
                text: 'This br is only applied on ICT and DCF.',
                severity: 'HIGH'
            },
            BR15: {
                text: 'This br is only applied on DCF.',
                severity: 'LOW'
            },
            BR16: {
                text: 'Reporting facets less detailed than the implicit facets is discouraged.',
                severity: 'HIGH'
            },
            BR17: {
                text: 'Reporting facets as base term is forbidden.',
                severity: 'HIGH'
            },
            BR19: {
                text: 'Processes that create a new derivative nature cannot be applied to raw commodity base terms.',
                severity: 'HIGH'
            },
            BR20: {
                text: 'The selected term cannot be used since it is deprecated.',
                severity: 'HIGH'
            },
            BR21: {
                text: 'The selected term cannot be used since it is dismissed.',
                severity: 'HIGH'
            },
            BR22: {
                text: 'Base term successfully added.',
                severity: 'NONE'
            },
            BR23: {
                text: 'The use of hierarchy terms as base term is discouraged.',
                severity: 'LOW'
            },
            BR24: {
                text: 'The hierarchy term selected does not belong to the exposure hierarchy.',
                severity: 'HIGH'
            },
            BR25: {
                text: 'Reporting more than one facet is forbidden for this category.',
                severity: 'HIGH'
            },
            BR26: {
                text: 'The selected processes cannot be used together for derivative base term.',
                severity: 'HIGH'
            },
            BR27: {
                text: 'Processes that create a new derivative nature cannot be applied to existing derivative base terms.',
                severity: 'HIGH'
            },
            BR28: {
                text: 'Processes that create a new derivative nature cannot be applied to existing derivative base terms. Start from the reconstituted/diluted term instead.',
                severity: 'HIGH'
            },
            BR29: {
                text: 'The code does not follow the required structure or is misspelled.',
                severity: 'ERROR'
            },
            BR30: {
                text: 'The category does not exist.',
                severity: 'ERROR'
            },
            BR31: {
                text: 'The facet is not valid for the facet category.',
                severity: 'ERROR'
            }
        };
    }

    /**
     * Get default warning colors if file not found
     */
    getDefaultWarningColors() {
        return {
            'NONE': { rgb: '255,255,255', description: 'White - No warning' },
            'LOW': { rgb: '255,255,0', description: 'Yellow - Low severity' },
            'HIGH': { rgb: '255,165,0', description: 'Orange - High severity' },
            'ERROR': { rgb: '255,0,0', description: 'Red - Error' }
        };
    }

    /**
     * Create data directory structure and copy files if needed
     */
    async ensureDataFiles() {
        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataPath, { recursive: true });

            // Check if files exist
            const files = ['BR_Data.csv', 'warningMessages.txt', 'warningColors.txt'];
            const missingFiles = [];

            for (const file of files) {
                try {
                    await fs.access(path.join(this.dataPath, file));
                } catch {
                    missingFiles.push(file);
                }
            }

            if (missingFiles.length > 0) {
                console.log('Missing data files:', missingFiles);
                console.log('Please copy these files from the catalogue-browser/business-rules directory');
            }

            return missingFiles.length === 0;
        } catch (error) {
            console.error('Error ensuring data files:', error);
            return false;
        }
    }
}

module.exports = DataLoader;