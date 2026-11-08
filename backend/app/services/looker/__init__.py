"""GCP Looker Utility: PBIP -> LookML conversion engine.

Ported from the existing desktop tool at
``PBI_Document_Generator/pbi_document_generator.py`` (see the migration
blueprint). Only the PBIP -> LookML path is migrated: Excel workbook
generation, model YAML export, multi-source merge, and the Tkinter UI
are intentionally excluded.

Business logic (regexes, parsing rules, SQL translation) is preserved
as-is from the source implementation; only structure/module layout and
I/O plumbing (filesystem paths -> extracted temp directories, disk
writes -> in-memory buffers) were adapted for a stateless web backend.
"""
