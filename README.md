# Tools Catalog

The **Tools Catalog** is a [DevRel Foundation](https://github.com/DevRel-Foundation) (DRF) initiative to collect software and tools used by Developer Relations professionals. This catalog helps support discovery of resources that help solve specific day-to-day operatonal tasks.

* [Requirements and Use Cases](https://github.com/DevRel-Foundation/wg-resource-aggregation/discussions/64)

## DevRel Foundation Tools Catalog (DEVREL-TC)

The DevRel Foundation Tools Catalog is an opinionated configuration framework for defining tools in a structured language (JSON) that adheres to an agreed upon standard schema. 

By defining tools in this way, we can establish tooling to validate, restructure, transform views on how we evalate tools.

### Explore the Tools Catalog

Tools are indexed along dimensions such as job categories and labels.

- [Explore Tool Indexes](./docs/index/index.md)

### Learning the DEVREL-TC

- [Getting Started with the Devrel Tools Catalog](./docs/guides/getting-started.md)

### Validating the Catalog

```
./bin/tc-validate --data data/*.json --schema src/schemas/tools.json
```

### Generating Indexes

```
./bin/tc-index --data data/*.json --schema src/schemas/tools.json --category docs/index/by-job-category --label docs/index/by-label
```

## License

All material contributed to the DRF Resources and Asset Aggregation Work Group is under [CC-BY-4.0 Licensing](https://creativecommons.org/licenses/by/4.0/deed.en).

See the [License and Intellectual Property](https://github.com/DevRel-Foundation/.github/blob/main/profile/README.md#license-and-intellectual-property) statement for instructions on how to reuse and adapt content from this repository, discussions, and issues with proper attribution to the Developer Relations Foundation.

## About the Tools Catalog

This project repository is maintained with support of the [Resource and Asset Aggregation Working Group](https://github.com/DevRel-Foundation/wg-resource-aggregation) and Developer Relations Foundation.

* [Contributing](./CONTRIBUTING.md)
* [Report Issues](https://github.com/DevRel-Foundation/wg-resource-aggregation/issues)
* [Questions & Feedback](https://github.com/DevRel-Foundation/wg-resource-aggregation/discussions/categories/tools-catalog)
* [Project Roadmap](https://github.com/orgs/DevRel-Foundation/projects/14)
