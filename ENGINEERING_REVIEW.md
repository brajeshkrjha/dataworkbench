# Engineering review

## Scope and compatibility

Reviewed the frontend application shell, navigation, themes, settings, stores,
catalog/search registries, API clients/contracts, shared UI, and every Parquet and
Looker module. Backend review covered configuration, errors, dependency injection,
registries, routes/schemas, converters, reader/analyzer/comparison services,
Looker discovery/parsing/generation/diff/packaging, job lifecycle, utilities, and
tests/build/dependency configuration.

The existing feature-based organization, service boundaries, and state library
were retained. No product tools, formats, endpoints, or UI redesigns were added.
Normal output formats, LookML naming/collision rules, local timestamp formats,
upload limits, sampling algorithms, and session TTL policy are unchanged.
Runtime OpenAPI and generated frontend API contracts remain unchanged.

## Improvements

- Centralized API transport/error parsing and standards-compliant header merging.
  Network/cancellation errors still propagate; malformed error bodies have the
  existing HTTP-status fallback rather than being treated as domain errors.
- Consolidated byte formatting, unsaved-work listeners, transient Blob downloads,
  and Looker project ZIP packaging. Existing feature import paths remain usable.
- Stopped obsolete bulk polling after reset/unmount, guarded stale Analyzer
  responses, deduplicated in-flight work, and fixed automatic failed-tab retries.
- Separated list filtering from pagination using stable predicates; presentation
  constants no longer import network hooks. Added tab keyboard/ARIA associations,
  labeled searches, and correct sortable-table semantics without eager tab loads.
- Added explicit Parquet handle lifetimes and narrow session locking/active-reader
  leases. Pagination reads bounded batches; eligible statistics read one column
  at a time, retaining the existing exactness threshold.
- Cleaned partial spools, conversion output-allocation failures, and Looker
  extraction/startup failures. Oversized Looker requests are read only up to the
  existing limit plus one byte, rather than duplicated entirely in memory.
- Fixed backend/frontend lint findings, removed dead work, added diagnostics to
  existing fallback paths, and made per-view field-name allocation explicit.
- Added read-only contract checks and documented test/lint/type/build commands.
  Ruff is pinned as a development dependency; no runtime framework was added.

## Measured performance

Synthetic Parquet benchmark: 500,000 rows in one row group, integer ID plus a
129-character string, 100-row page, five-run median on this Windows environment.
Both implementations were checked for identical returned rows.

| Pagination algorithm | Row offset | Median time | Retained Arrow buffers |
| --- | ---: | ---: | ---: |
| Whole-row-group slice (previous) | 0 | 29.8 ms | 70,562,688 bytes |
| Bounded batches | 0 | 3.0 ms | 1,156,224 bytes |
| Whole-row-group slice (previous) | 499,000 | 26.1 ms | 70,562,688 bytes |
| Bounded batches | 499,000 | 30.8 ms | 1,156,224 bytes |

Retained page buffers decreased approximately **98.36%**. First-page latency
improved in this fixture; deep-page latency was slightly higher because batches
are decoded to reach the requested offset. These are not peak-RSS measurements
or a claim of universal speedup.

The filtering regression verifies that 120 source items require 120 predicate
calls once; unchanged rerenders and pagination do not repeat the filtering pass.
No measured bundle-size reduction is claimed.

## Verification

| Check | Baseline | Final result |
| --- | --- | --- |
| Frontend Vitest | 102 passing | **178 passing**, 28 test files |
| Backend pytest | 103 passing | **141 passing** |
| TypeScript | Passing | Passing |
| Frontend ESLint | Existing findings | Passing |
| Backend Ruff | Existing findings | Passing |
| Runtime OpenAPI snapshot | Matched | Matches; read-only check added |
| Generated TypeScript API | Existing snapshot | Matches; read-only check added |
| Production Next.js build | Not measured | Passing; all page generation completed |
| Editor diagnostics | — | No errors reported |

**114 additional test cases** cover API failures/headers/cancellation, shared
helpers, polling and stale responses, failed-tab retry behavior, keyboard/ARIA
semantics, filtered-list memoization, bounded Parquet reads, file ownership and
concurrency, Looker resource failures, naming collisions, and contract drift.
The pending-bulk-download regression now controls job state rather than racing
a background thread.

Real HTTP smoke checks passed against temporary loopback servers: health,
version/catalog, CSV-to-Parquet download metadata and Reader paging, all six
Analyzer endpoint groups, schema comparison, Looker conversion ZIPs, preview,
structure exploration, identical-package comparison, and empty-batch
status/download. **13 production frontend page routes returned HTTP 200 HTML.**
Temporary servers and smoke-test upload files were removed afterward. These
checks do not substitute for browser-driven end-to-end interaction coverage.

Existing non-failing dependency warnings remain: Vite's CJS Node API and
Starlette's legacy httpx test-client integration. No warnings were globally
suppressed and no framework upgrades were introduced to hide them.

## Deferred deployment concerns

- Session and bulk-job state are process-local; multi-worker/multi-instance
  persistence was not introduced.
- Completed bulk jobs retain their output bytes. Reader TTL eviction remains
  upload-triggered. Changing retention or shutdown behavior needs an explicit
  lifecycle policy rather than silently changing download/session availability.
- Random sampling and some whole-column analyses remain memory intensive.
- Archive expansion quotas, PBIP artifact path trust boundaries, authentication,
  concurrency admission, and deployment-level resource limits need a separate
  security/deployment policy review before exposure to untrusted multi-user use.
- Runtime dependency ranges and transitive warning migrations remain separate
  dependency-management work; this pass is not a production-readiness certificate.

## Files changed

Intentional source, test, configuration, and documentation changes are listed
below. Generated framework caches/build artifacts and local environment package
installations are excluded. OpenAPI and generated API type snapshots were not
rewritten.

### Documentation and quality configuration

- [README.md](README.md)
- [ENGINEERING_REVIEW.md](ENGINEERING_REVIEW.md)
- [backend/pyproject.toml](backend/pyproject.toml)
- [backend/requirements-dev.txt](backend/requirements-dev.txt)
- [backend/scripts/export_openapi.py](backend/scripts/export_openapi.py)
- [frontend/package.json](frontend/package.json)

### Frontend shared code and tests

- [frontend/src/services/api-client.ts](frontend/src/services/api-client.ts)
- [frontend/src/services/api-client.test.ts](frontend/src/services/api-client.test.ts)
- [frontend/src/lib/download-blob.ts](frontend/src/lib/download-blob.ts)
- [frontend/src/lib/download-blob.test.ts](frontend/src/lib/download-blob.test.ts)
- [frontend/src/lib/format-bytes.ts](frontend/src/lib/format-bytes.ts)
- [frontend/src/lib/format-bytes.test.ts](frontend/src/lib/format-bytes.test.ts)
- [frontend/src/hooks/use-filtered-list.ts](frontend/src/hooks/use-filtered-list.ts)
- [frontend/src/hooks/use-filtered-list.test.ts](frontend/src/hooks/use-filtered-list.test.ts)
- [frontend/src/hooks/use-unsaved-work-warning.ts](frontend/src/hooks/use-unsaved-work-warning.ts)
- [frontend/src/components/ui/tabs.tsx](frontend/src/components/ui/tabs.tsx)
- [frontend/src/components/ui/tabs.test.tsx](frontend/src/components/ui/tabs.test.tsx)

### Frontend Looker integrations

- [frontend/src/features/looker/shared/format-bytes.ts](frontend/src/features/looker/shared/format-bytes.ts)
- [frontend/src/features/looker/shared/use-unsaved-work-warning.ts](frontend/src/features/looker/shared/use-unsaved-work-warning.ts)
- [frontend/src/features/looker/shared/project-zip.ts](frontend/src/features/looker/shared/project-zip.ts)
- [frontend/src/features/looker/shared/project-zip.test.ts](frontend/src/features/looker/shared/project-zip.test.ts)
- [frontend/src/features/looker/shared/use-pbip-upload.ts](frontend/src/features/looker/shared/use-pbip-upload.ts)
- [frontend/src/features/looker/modules/convert/hooks/use-looker-conversion.ts](frontend/src/features/looker/modules/convert/hooks/use-looker-conversion.ts)
- [frontend/src/features/looker/modules/convert/hooks/use-bulk-conversion.ts](frontend/src/features/looker/modules/convert/hooks/use-bulk-conversion.ts)
- [frontend/src/features/looker/modules/convert/hooks/use-bulk-conversion.test.ts](frontend/src/features/looker/modules/convert/hooks/use-bulk-conversion.test.ts)
- [frontend/src/features/looker/modules/explore/components/explore-panels.tsx](frontend/src/features/looker/modules/explore/components/explore-panels.tsx)
- [frontend/src/features/looker/modules/preview/components/project-explorer-tree.tsx](frontend/src/features/looker/modules/preview/components/project-explorer-tree.tsx)
- [frontend/src/features/looker/modules/preview/preview-module.tsx](frontend/src/features/looker/modules/preview/preview-module.tsx)
- [frontend/src/features/looker/modules/compare/compare-module.tsx](frontend/src/features/looker/modules/compare/compare-module.tsx)
- [frontend/src/features/looker/modules/compare/use-lookml-compare.ts](frontend/src/features/looker/modules/compare/use-lookml-compare.ts)

### Frontend Parquet integrations

- [frontend/src/features/parquet/shared/format-bytes.ts](frontend/src/features/parquet/shared/format-bytes.ts)
- [frontend/src/features/parquet/shared/use-unsaved-work-warning.ts](frontend/src/features/parquet/shared/use-unsaved-work-warning.ts)
- [frontend/src/features/parquet/modules/analyzer/hooks/use-parquet-analyzer.ts](frontend/src/features/parquet/modules/analyzer/hooks/use-parquet-analyzer.ts)
- [frontend/src/features/parquet/modules/analyzer/hooks/use-parquet-analyzer.test.ts](frontend/src/features/parquet/modules/analyzer/hooks/use-parquet-analyzer.test.ts)
- [frontend/src/features/parquet/modules/analyzer/analyzer-module.tsx](frontend/src/features/parquet/modules/analyzer/analyzer-module.tsx)
- [frontend/src/features/parquet/modules/analyzer/analyzer-module.test.tsx](frontend/src/features/parquet/modules/analyzer/analyzer-module.test.tsx)
- [frontend/src/features/parquet/modules/comparison/hooks/use-schema-comparison.ts](frontend/src/features/parquet/modules/comparison/hooks/use-schema-comparison.ts)
- [frontend/src/features/parquet/modules/comparison/comparison-module.test.tsx](frontend/src/features/parquet/modules/comparison/comparison-module.test.tsx)
- [frontend/src/features/parquet/modules/reader/constants.ts](frontend/src/features/parquet/modules/reader/constants.ts)
- [frontend/src/features/parquet/modules/reader/hooks/use-parquet-reader.ts](frontend/src/features/parquet/modules/reader/hooks/use-parquet-reader.ts)
- [frontend/src/features/parquet/modules/reader/components/data-grid.tsx](frontend/src/features/parquet/modules/reader/components/data-grid.tsx)
- [frontend/src/features/parquet/modules/reader/components/data-grid.test.tsx](frontend/src/features/parquet/modules/reader/components/data-grid.test.tsx)

### Backend runtime code

- [backend/app/api/routers/parquet.py](backend/app/api/routers/parquet.py)
- [backend/app/api/routers/looker.py](backend/app/api/routers/looker.py)
- [backend/app/core/exceptions.py](backend/app/core/exceptions.py)
- [backend/app/utils/file_utils.py](backend/app/utils/file_utils.py)
- [backend/app/services/parquet/reader_service.py](backend/app/services/parquet/reader_service.py)
- [backend/app/services/parquet/schema_comparison_service.py](backend/app/services/parquet/schema_comparison_service.py)
- [backend/app/services/parquet/conversion_service.py](backend/app/services/parquet/conversion_service.py)
- [backend/app/services/processing_pipeline.py](backend/app/services/processing_pipeline.py)
- [backend/app/services/looker/bulk_conversion.py](backend/app/services/looker/bulk_conversion.py)
- [backend/app/services/looker/bulk_discovery.py](backend/app/services/looker/bulk_discovery.py)
- [backend/app/services/looker/bulk_service.py](backend/app/services/looker/bulk_service.py)
- [backend/app/services/looker/compare_adapters.py](backend/app/services/looker/compare_adapters.py)
- [backend/app/services/looker/file_resolution.py](backend/app/services/looker/file_resolution.py)
- [backend/app/services/looker/lookml_builder.py](backend/app/services/looker/lookml_builder.py)
- [backend/app/services/looker/lookml_naming.py](backend/app/services/looker/lookml_naming.py)
- [backend/app/services/looker/lookml_package_parser.py](backend/app/services/looker/lookml_package_parser.py)
- [backend/app/services/looker/lookml_packager.py](backend/app/services/looker/lookml_packager.py)
- [backend/app/services/looker/model_parser.py](backend/app/services/looker/model_parser.py)
- [backend/app/services/looker/pipeline.py](backend/app/services/looker/pipeline.py)
- [backend/app/services/looker/preview_builder.py](backend/app/services/looker/preview_builder.py)
- [backend/app/services/looker/report_parser.py](backend/app/services/looker/report_parser.py)
- [backend/app/services/looker/structure_explorer.py](backend/app/services/looker/structure_explorer.py)
- [backend/app/services/looker/table_classification.py](backend/app/services/looker/table_classification.py)
- [backend/app/services/looker/text_utils.py](backend/app/services/looker/text_utils.py)
- [backend/app/services/looker/usage_analysis.py](backend/app/services/looker/usage_analysis.py)

### Backend tests

- [backend/app/tests/test_utils.py](backend/app/tests/test_utils.py)
- [backend/app/tests/test_upload_cleanup.py](backend/app/tests/test_upload_cleanup.py)
- [backend/app/tests/test_parquet_resources.py](backend/app/tests/test_parquet_resources.py)
- [backend/app/tests/test_parquet_reader.py](backend/app/tests/test_parquet_reader.py)
- [backend/app/tests/test_looker.py](backend/app/tests/test_looker.py)
- [backend/app/tests/test_bulk_convert.py](backend/app/tests/test_bulk_convert.py)
- [backend/app/tests/test_looker_resources.py](backend/app/tests/test_looker_resources.py)
- [backend/app/tests/test_openapi.py](backend/app/tests/test_openapi.py)