/**
 * Service layer for the Text Compare Utility API.
 */
import { apiPostForm, apiPostJsonForBlob } from "@/services/api-client";
import type { ComparisonExportFormat, ComparisonInputType, ComparisonResult } from "@/types/text-compare";

const BASE_PATH = "/tools/text-compare-utility";

export interface CompareInput {
  fileA: File | null;
  textA: string;
  fileB: File | null;
  textB: string;
  typeOverride: ComparisonInputType | null;
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export const textCompareService = {
  async compare(input: CompareInput): Promise<ComparisonResult> {
    const formData = new FormData();
    if (input.fileA) formData.append("file_a", input.fileA);
    if (input.textA) formData.append("text_a", input.textA);
    if (input.fileB) formData.append("file_b", input.fileB);
    if (input.textB) formData.append("text_b", input.textB);
    if (input.typeOverride) formData.append("type_override", input.typeOverride);
    if (input.ignoreCase) formData.append("ignore_case", "true");
    if (input.ignoreWhitespace) formData.append("ignore_whitespace", "true");

    return apiPostForm<ComparisonResult>(`${BASE_PATH}/compare`, formData);
  },

  async exportReport(result: ComparisonResult, format: ComparisonExportFormat): Promise<Blob> {
    return apiPostJsonForBlob(`${BASE_PATH}/compare/export?format=${format}`, result);
  },
};
