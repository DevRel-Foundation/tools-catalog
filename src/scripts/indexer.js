/**
 * Tooling Catalog Indexer
 * 
 * This script processes JSON data files and generates indexes based on the
 * provided schema.
 * 
 * Example usage:
 * 
 * ./bin/tc-index --data data/*.json --schema src/schemas/tools.json
 *   --category docs/index/by-job-category
 *   --label docs/index/by-label
 *   --index docs/index/index.json
 *   --verbose
 *   --debug
 */

const fs = require('fs');
const path = require('path');
const args = require('yargs')
    .option('schema', {type: 'string', desc: 'schema to use for parsing (optional if defined in data file)'})
    .option('data', {type: 'array', desc: 'data files to index'})
    .option('label', {type: 'string', desc: 'output directory for generated labels index files'})
    .option('category', {type: 'string', desc: 'output directory for generated job category index files'})
    .option('index', {type: 'string', desc: 'output path for generated JSON index file'})
    .option('verbose', {type: 'boolean'})
    .option('debug', {type: 'boolean'})
    .demand(['data', 'schema'])
    .check((argv) => {
        if (!(argv.index || argv.label || argv.category)) {
            throw new Error('Please provide at least one output option: --label, --category, or --index');
        }
        return true;
    })
    .argv;

// Message to insert into generated markdown files
const contributing_message = '\nDO NOT EDIT. This file was automatically generated.\nSee [CONTRIBUTING](../../../CONTRIBUTING.md) for details on updating.\n\n';

let index = {
    processed: {},
    errors: {},
    labels: {},
    jobs: {},
    total: 0
};

/**
 * Write messages to stdout when verbose flag is given, 
 * otherwise will suppress log output.
 *  
 * @param {string} msg - message to log
 * 
 */
function log(msg) {
    if (args.verbose || args.debug) {
        console.log(msg);
    }
}

/**
 * Write messages to stdout when debug flag is given, 
 * otherwise will suppress log output.
 *  
 * @param {string} msg - message to log
 * 
 */
function debug(msg) {
    if (args.debug) {
        console.log(msg);
    }
}

/**
 * Convert a string to Title Case. This is the format used for headings
 * in markdown documents being created.
 * @param {*} str 
 */
function to_title_case(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}


/**
 * Returns a string formatted for use as an internal anchor link. This is
 * used for example in markdown files that link to each heading from the
 * top of the document.
 * @param {*} str 
 */
function to_internal_anchor(str) { 
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}


/**
 * 
 * Validate and return the schema to use for parsing data files.
 */
function get_schema(schemaPath) {
    log(`Using schema: ${schemaPath}`);

    // Setup validator for proper parsing of schema
    const Ajv = require("ajv/dist/2020");
    const addFormats = require("ajv-formats");
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    let schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    return schema;
}

/**
 * Return the list of labels from the schema definition
 * @param {*} schema 
 * @returns 
 */
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

/**
 * Returns the set of categories and descriptions from the schema definition.
 * @param {*} schema 
 */
function get_jobs_to_be_done(schema) {
    const categories = {};
    const outcomes = {};
    const situations = {};
    const motivations = {};
    Object.keys(schema.$defs).forEach(key => {
        if (key.startsWith('category-')) {
            let category = schema.$defs[key].const;
            let description = schema.$defs[key].description || '';
            categories[category] = {description: description, tools: [], count: 0};
        } else if (key.startsWith('outcome-')) {
            let outcome = schema.$defs[key].const;
            let description = schema.$defs[key].description || '';
            outcomes[outcome] = {description: description, tools: [], count: 0};
        } else if (key.startsWith('situation-')) {
            let situation = schema.$defs[key].const;
            let description = schema.$defs[key].description || '';
            situations[situation] = {description: description, tools: [], count: 0};
        } else if (key.startsWith('motivation-')) {
            let motivation = schema.$defs[key].const;
            let description = schema.$defs[key].description || '';
            motivations[motivation] = {description: description, tools: [], count: 0};
        }
    });

    return {
        categories: categories,
        outcomes: outcomes,
        situations: situations,
        motivations: motivations
    };
}

/**
 * Process all of the data files into the index, storing each
 * as an asset for additional processing.
 * 
 * NOTE: this could become a bottleneck later and/or consume a
 * lot of memory if there is a large number of tools, but that
 * would be unexpected.
 * 
 */
function read_data_files(files) {
    files.forEach(filePath => {
        log(`...processing ${filePath}`);
        try {
            const asset = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const filename = path.basename(filePath, '.json');

            index.processed[filename] = {
                asset: asset,
                name: asset.name || filename,
            };
        } catch (error) {
            console.error(`Error processing ${data}: ${error.message}`);
            index.errors[data] = {};
        }
    });
}


/**
 * Analyze the assets and associate with each jtbd and label.
 */
function index_assets() {
    index.total = Object.keys(index.processed).length;

    Object.keys(index.processed).forEach(key => {
        let entry = index.processed[key];

        // Index by Label
        if (entry.asset.labels) {
            entry.asset.labels.forEach(label => {
                index.labels[label].tools.push(key);
                index.labels[label].count += 1;
            });
        }

        // Index by Jobs
        if (entry.asset.jobs) {
            // Index by Job Category
            if (entry.asset.jobs.categories) {
                entry.asset.jobs.categories.forEach(category => {
                    if (!index.jobs.categories[category]) {
                        console.warn(`Warning: category ${category} not found in schema definitions`);
                        return;
                    }
                    index.jobs.categories[category].tools.push(key);
                    index.jobs.categories[category].count += 1;
                });
            }

            // Index by Job Outcome
            if (entry.asset.jobs.outcomes) {
                entry.asset.jobs.outcomes.forEach(outcome => {
                    if (!index.jobs.outcomes[outcome]) {
                        console.warn(`Warning: outcome ${outcome} not found in schema definitions`);
                        next;
                    }
                    index.jobs.outcomes[outcome].tools.push(key);
                    index.jobs.outcomes[outcome].count += 1;
                });
            }

            // Index by Job Situation
            if (entry.asset.jobs.situations) {
                entry.asset.jobs.situations.forEach(situation => {
                    if (!index.jobs.situations[situation]) {
                        console.warn(`Warning: situation ${situation} not found in schema definitions`);
                        next;
                    }
                    index.jobs.situations[situation].tools.push(key);
                    index.jobs.situations[situation].count += 1;
                });
            }

            // Index by Job Motivation
            if (entry.asset.jobs.motivations) {
                entry.asset.jobs.motivations.forEach(motivation => {
                    if (!index.jobs.motivations[motivation]) {
                        console.warn(`Warning: motivation ${motivation} not found in schema definitions`);
                        next;
                    }
                    index.jobs.motivations[motivation].tools.push(key);
                    index.jobs.motivations[motivation].count += 1;
                });
            }
        }
    });
}

/**
 * Write out the JSON index to the given file path after removing the 
 * asset data.
 * @param {*} outPath 
 */
function write_json_index(outPath) {
    // Remove the asset data from the index before writing
    Object.keys(index.processed).forEach(key => {
        if (!args.debug) {
            delete index.processed;
            delete index.errors;
        }
    });
    fs.writeFileSync(outPath, JSON.stringify(index, null, 2), 'utf8');
    log(`Wrote index to ${outPath}`);
}


/**
 * Creates a markdown file for the given tool data list.
 *  
 * @param {*} outPath 
 * @param {*} data 
 */
function write_markdown_single_index(outPath, data) {
    let count = 0;

    // Ensure output directory exists
    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath, { recursive: true });
    }

    Object.keys(data).forEach(key => {
        if (data[key].tools.length === 0) {
            debug(`...skipping ${key} because there are no tools to index.`);
            return;
        }

        let content = contributing_message;
        let outputFilePath = path.join(outPath, key.toLowerCase().replace(/\s+/g, '-') + '.md');

        content += `# ${to_title_case(key)}\n\n`;

        data[key].tools.forEach(tool => {
            content += `**${index.processed[tool].asset.name}**`;
            content += ` | ${index.processed[tool].asset.url}  \n`;
            content += `${index.processed[tool].asset.description}`;
            content += ` ([Source Data](${path.relative(outPath, path.resolve(args.data.find(d => d.includes(tool))))}))\n\n`;
        });

        fs.writeFileSync(outputFilePath, content, 'utf8');
        count += 1;
        log(`Generated: ${outputFilePath}`);
    });

    return count;
}


/**
 * Creates a markdown file for the given tool data list but takes into account
 * a secondary index to create multiple levels of indexing.
 *  
 * @param {*} outPath 
 * @param {*} data 
 */
function write_markdown_secondary_index(outPath, data1, data2) {
    let count = 0;

    // Ensure output directory exists
    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath, { recursive: true });
    }

    Object.keys(data1).forEach(key => {
        if (data1[key].tools.length === 0) {
            debug(`...skipping ${key} because there are no tools to index.`);
            return;
        }

        let content = contributing_message;
        let outputFilePath = path.join(outPath, key.toLowerCase().replace(/\s+/g, '-') + '.md');

        content += `# ${to_title_case(key)}\n\n`;
        content += `${data1[key].description}\n\n`;

        let toc = '';
        let subs = [];
        Object.keys(data2).forEach(key2 => {
            let sub = '';
            data2[key2].tools.forEach(tool => {
                // Only include tools that are also in the first index
                if (data1[key].tools.includes(tool)) {
                    if (sub === '') {
                        sub += `## ${to_title_case(key2)}\n\n`;
                        sub += `${data2[key2].description}\n\n`;
                    }
                    sub += `**${index.processed[tool].asset.name}**`;
                    sub += ` | ${index.processed[tool].asset.url}  \n`;
                    sub += `${index.processed[tool].asset.description}`;
                    sub += ` ([Source Data](${path.relative(outPath, path.resolve(args.data.find(d => d.includes(tool))))}))\n\n`;
                }
            });

            if (sub === '') {
                debug(`...skipping "${key2}" for "${key}" because there are no tools in both indexes.`);
                return;
            }

            toc += `- [${to_title_case(key2)}](#${to_internal_anchor(key2)})\n`;
            subs.push(sub);
            sub = '';
        });


        content += toc + '\n\n';
        content += subs.join('\n');


        fs.writeFileSync(outputFilePath, content, 'utf8');
        count += 1;
        log(`Generated: ${outputFilePath}`);
    });

    return count;
}


/**
 * Main entry point for generating an index.
 * @param {*} index 
 */
function main(index) {
    let schemaPath = args.schema || '../schemas/tools.json';
    let schema = get_schema(schemaPath);

    // Get the list of labels
    let labels = get_labels(schema);
    labels.forEach(label => {
        index.labels[label] = {tools: [], count: 0};
    });
    log("Indexed labels.");

    // Get the list of jobs to be done
    index.jobs = get_jobs_to_be_done(schema);
    log("Indexed jobs to be done.");
    // debug(index);

    read_data_files(args.data);
    // debug(index);
    log("Read data files.");

    index_assets();
    debug(index);
    log("Indexed assets.");

    // --label argument will write out markdown files for each label
    if (args.label) {
        log("Getting ready to write labels...");
        let count = write_markdown_single_index(args.label, index.labels)
        console.log(`Wrote ${count} label indexes to ${args.label}`);
    }
    // --category argument will write out markdown files for each job category
    if (args.category) {
        log("Getting ready to write categories...");
        let count = write_markdown_secondary_index(args.category, index.jobs.categories, index.jobs.outcomes)
        console.log(`Wrote ${count} category indexes to ${args.category}`);
    }

    // --index argument will write out a JSON index file with defs and counts
    // This should be last because before writing out the index processed files
    // are cleared to reduce size.
    if (args.index) {
        log("Getting ready to write JSON index...");
        write_json_index(args.index);
        console.log(`Wrote JSON index to ${args.index}`);
    }
}

main(index);