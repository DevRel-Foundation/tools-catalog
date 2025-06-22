
// bin/tc-index --data data/*.json --labels docs/labels --schema src/schemas/tools.json 

const fs = require('fs');
const path = require('path');
const args = require('yargs')
    .option('schema', {type: 'string', desc: 'schema to use for parsing (optional if defined in data file)'})
    .option('data', {type: 'array', desc: 'data files to index'})
    .option('labels', {type: 'string', desc: 'output directory for generated labels index files'})
    .option('verbose', {type: 'boolean'})
    .demand(['data', 'schema'])
    .argv;

// Function to log messages to stdout if verbose mode is enabled
function log(msg) {
    if (args.verbose) {
        console.log(msg);
    }
}

// Return a list of labels from the schema definition
function get_labels(schema) {
    const labels = [];
    
    if (!schema || !schema.$defs) {
        return labels;
    }
    
    const enumValues = schema.properties.labels.items.enum || [];
    enumValues.forEach(value => {
        labels.push(value);
    });
    
    return labels;
}
    

// Main function to process and index data files
function main() {
    const Ajv = require("ajv/dist/2020");
    const addFormats = require("ajv-formats");
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    // Pre-load schema if provided via command line
    let defaultSchema = null;
    if (args.schema) {
        defaultSchema = JSON.parse(fs.readFileSync(args.schema, 'utf8'));
        log(`Using command line schema: ${args.schema}`);
    }


    let report = {
        processed: 0,
        errors: 0,
        files: {},
        labels: {}
    };

    // Iterate over each data file to process it
    args.data.forEach(item => {
        log(`Processing: ${item}`);
        
        try {
            const asset = JSON.parse(fs.readFileSync(item, 'utf8'));

            // Add to index
            const filename = path.basename(item, '.json');
            report.files[filename] = {
                asset: asset,
                name: asset.name || filename,
            };

            if (asset.labels) { 
                asset.labels.forEach(label => {
                    if (!report.labels[label]) {
                        report.labels[label] = [];
                    }
                    report.labels[label].push({
                        name: asset.name || filename,
                        file: path.resolve(item)
                    });
                })
            }

            report.processed++;
            
        } catch (error) {
            console.error(`Error processing ${item}: ${error.message}`);
            report.errors++;
        }
    });
    console.log(`Finished! Processed ${report.processed} files with ${report.errors} errors.`);

    if (args.labels) {
        // Ensure output directory exists
        if (!fs.existsSync(args.labels)) {
            fs.mkdirSync(args.labels, { recursive: true });
        }

        let labels = get_labels(defaultSchema);
        labels.forEach(label => {
            const filename = label.toLowerCase().replace(/\s+/g, '-') + '.md';
            const outputPath = path.join(args.labels, filename);
            log("...generating:" + outputPath);

            if (label in report.labels) {
                console.log(report.labels[label]);

                let content = 'DO NOT EDIT. This file was automatically generated. See [CONTRIBUTING](../../CONTRIBUTING.md) for details on making changes.';
                content += `\n\n`;
                content += `# ${label.toUpperCase()}\n\n` 

                content += report.labels[label].map(tool => `- [${tool.name}](${path.relative(args.labels, tool.file)})`).join('\n') + '\n';
                
                fs.writeFileSync(outputPath, content, 'utf8');
            }
        });
    }
}


main();