
// bin/tc-index --data data/*.json --labels docs/label --schema src/schemas/tools.json 
// bin/tc-index --data data/*.json --categories docs/category --schema src/schemas/tools.json 

const fs = require('fs');
const path = require('path');
const args = require('yargs')
    .option('schema', {type: 'string', desc: 'schema to use for parsing (optional if defined in data file)'})
    .option('data', {type: 'array', desc: 'data files to index'})
    .option('label', {type: 'string', desc: 'output directory for generated labels index files'})
    .option('category', {type: 'string', desc: 'output directory for generated job category index files'})
    .option('verbose', {type: 'boolean'})
    .demand(['data', 'schema'])
    .argv;

// Message to insert into generated markdown files
const contributing_message = '\nDO NOT EDIT. This file was automatically generated.\nSee [CONTRIBUTING](../../CONTRIBUTING.md) for details on updating.\n\n';

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

function to_title_case(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function to_internal_anchor(str) { 
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

function get_schema() {
    // Setup validation if required
    const Ajv = require("ajv/dist/2020");
    const addFormats = require("ajv-formats");
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    // Pre-load schema if provided via command line
    let defaultSchema = null;
    if (args.schema) {
        defaultSchema = JSON.parse(fs.readFileSync(args.schema, 'utf8'));
    }

    log(`Using schema: ${args.schema}`);
    return defaultSchema;
}



function main() {
    // index the data files
    let index = {
        processed: {},
        errors: {},
        categories: {},
        labels: {},
        descriptions: {},
    };

    let schema = get_schema();
    Object.keys(schema.$defs).forEach(key => {
        index.descriptions[schema.$defs[key].const] = schema.$defs[key].description || '';
    });

    args.data.forEach(data => {
        log(`...processing ${data}`);

        try {
            const asset = JSON.parse(fs.readFileSync(data, 'utf8'));
            const filename = path.basename(data, '.json');

            index.processed[filename] = {
                asset: asset,
                name: asset.name || filename,
            };

            // Create an index by label
            if (args.label && asset.labels) {
                asset.labels.forEach(label => {
                    if (!index.labels[label]) {
                        index.labels[label] = [];
                    }

                    let entry = {
                        filename: filename,
                        name: asset.name || filename,
                        url: asset.url || null,
                        description: asset.description || '',
                        file: path.relative(args.label, path.resolve(data))
                    }

                    index.labels[label].push(entry);
                });
            }

            // Create an index by job category and outcome
            if (args.category && asset.jobs.categories) {

                asset.jobs.categories.forEach(category => {
                    if (!index.categories[category]) {
                        index.categories[category] = {};
                    }

                    asset.jobs.outcomes.forEach(outcome => {
                        if (!index.categories[category][outcome]) {
                            index.categories[category][outcome] = [];
                        }

                        let entry = {
                            filename: filename,
                            name: asset.name || filename,
                            url: asset.url || null,
                            description: asset.description || '',
                            file: path.relative(args.category, path.resolve(data))
                        }

                        index.categories[category][outcome].push(entry);
                    });
                });
            }

        } catch (error) {
            console.error(`Error processing ${data}: ${error.message}`);
            index.errors[data] = {};
        }
    });

    console.log(`Processed ${Object.keys(index.processed).length} data files and skipped ${Object.keys(index.errors).length} with errors.`);

    // Write labels out to markdown files when given as a parameter
    if (args.label) {
        // Ensure output directory exists
        if (!fs.existsSync(args.label)) {
            fs.mkdirSync(args.label, { recursive: true });
        }

        Object.keys(index.labels).forEach(label => {
            const filename = label.toLowerCase().replace(/\s+/g, '-') + '.md';
            const outputPath = path.join(args.label, filename);

            let content = contributing_message;
            content += `# ${label.toUpperCase()}\n\n`; 
            content += index.labels[label].map(tool => `**${tool.name}** | ${tool.url}  \n${tool.description} ([Source Data](${tool.file}))`).join('\n\n') + '\n';

            fs.writeFileSync(outputPath, content, 'utf8');
            log(`Generated: ${outputPath}`);
        });
    }

    if (args.category) {
        // Ensure output directory exists
        if (!fs.existsSync(args.category)) {
            fs.mkdirSync(args.category, { recursive: true });
        }

        Object.keys(index.categories).forEach(category => {
            const filename = category.toLowerCase().replace(/\s+/g, '-') + '.md';
            const outputPath = path.join(args.category, filename);

            let content = contributing_message;
            content += `# ${category.toUpperCase()}\n\n`;

            content += index.descriptions[category] ? `${index.descriptions[category]}\n\n` : '';

            Object.keys(index.categories[category]).forEach(outcome => {
                content += `- [${to_title_case(outcome)}](#${to_internal_anchor(outcome)})\n`;
            })

            content += '\n\n';

            Object.keys(index.categories[category]).forEach(outcome => {
                content += `## ${to_title_case(outcome)}\n\n`;

                content += index.descriptions[outcome] ? `${index.descriptions[outcome]}\n\n` : '';

                content += index.categories[category][outcome].map(tool => `**${tool.name}** | ${tool.url}  \n${tool.description} ([Source Data](${tool.file}))`).join('\n\n') + '\n\n';
            });

            fs.writeFileSync(outputPath, content, 'utf8');
            log(`Generated: ${outputPath}`);
        });
    }
}


if (args.label || args.category) {
    main();
}